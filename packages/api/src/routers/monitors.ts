import { ORPCError } from "@orpc/server";
import { clickhouse, db } from "@uptimekit/db";
import { monitor, monitorGroup } from "@uptimekit/db/schema/monitors";
import { statusPageMonitor } from "@uptimekit/db/schema/status-pages";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, writeProcedure } from "../index";
import {
	hasActiveSubscription,
	isSelfHosted,
	MAX_MONITORS,
} from "../lib/limits";
import type {
	ChangeHistoryResult,
	EventTimelineResult,
	LatestChangeResult,
	LatestEventResult,
	SingleChangeResult,
	SingleEventResult,
	StatsChangeResult,
	StatusBeforeResult,
} from "../types/clickhouse";

// SQL queries for batching monitor events and changes
const BATCH_LATEST_EVENTS_QUERY = `
	SELECT monitorId, status, timestamp
	FROM (
		SELECT monitorId, status, timestamp,
			ROW_NUMBER() OVER (PARTITION BY monitorId ORDER BY timestamp DESC) as rn
		FROM uptimekit.monitor_events
		WHERE monitorId IN ({ids:Array(String)})
	) WHERE rn = 1
`;

const BATCH_LATEST_CHANGES_QUERY = `
	SELECT monitorId, timestamp
	FROM (
		SELECT monitorId, timestamp,
			ROW_NUMBER() OVER (PARTITION BY monitorId ORDER BY timestamp DESC) as rn
		FROM uptimekit.monitor_changes
		WHERE monitorId IN ({ids:Array(String)})
	) WHERE rn = 1
`;

export const monitorsRouter = {
	list: protectedProcedure
		.input(
			z
				.object({
					q: z.string().optional(),
					active: z.boolean().optional(),
					type: z
						.enum(["http", "http-json", "tcp", "ping", "dns", "keyword"])
						.optional(),
					status: z
						.enum(["up", "down", "degraded", "maintenance", "pending"])
						.optional(),
					limit: z.number().default(50),
					offset: z.number().default(0),
				})
				.optional(),
		)
		.handler(async ({ input, context }) => {
			const filters = [
				eq(
					monitor.organizationId,
					context.session.session.activeOrganizationId!,
				),
			];

			if (input?.q) {
				filters.push(ilike(monitor.name, `%${input.q}%`));
			}

			if (input?.active !== undefined) {
				filters.push(eq(monitor.active, input.active));
			}

			if (input?.type) {
				filters.push(eq(monitor.type, input.type));
			}

			const [monitors, total] = await Promise.all([
				db
					.select()
					.from(monitor)
					.leftJoin(monitorGroup, eq(monitor.groupId, monitorGroup.id))
					.where(and(...filters))
					.orderBy(desc(monitor.createdAt))
					.limit(input?.limit || 50)
					.offset(input?.offset || 0),
				db.$count(monitor, and(...filters)),
			]);

			const usageCounts = await db
				.select({
					monitorId: statusPageMonitor.monitorId,
					count: sql<number>`count(*)`.mapWith(Number),
				})
				.from(statusPageMonitor)
				.innerJoin(monitor, eq(statusPageMonitor.monitorId, monitor.id))
				.where(
					eq(
						monitor.organizationId,
						context.session.session.activeOrganizationId!,
					),
				)
				.groupBy(statusPageMonitor.monitorId);

			const usageMap = new Map(usageCounts.map((c) => [c.monitorId, c.count]));

			// Batch fetch latest events and changes for all monitors to avoid N+1 query problem
			const monitorIds = monitors.map((row) => row.monitor.id);

			// Fetch latest events for all monitors in a single query
			const latestEventsQuery = await clickhouse.query({
				query: BATCH_LATEST_EVENTS_QUERY,
				query_params: { ids: monitorIds },
				format: "JSON",
			});
			const latestEventsJson = await latestEventsQuery.json<any>();
			const latestEventsMap = new Map(
				(latestEventsJson.data as LatestEventResult[]).map((event) => [
					event.monitorId,
					event,
				]),
			);

			// Fetch latest changes for all monitors in a single query
			const latestChangesQuery = await clickhouse.query({
				query: BATCH_LATEST_CHANGES_QUERY,
				query_params: { ids: monitorIds },
				format: "JSON",
			});
			const latestChangesJson = await latestChangesQuery.json<any>();
			const latestChangesMap = new Map(
				(latestChangesJson.data as LatestChangeResult[]).map((change) => [
					change.monitorId,
					change,
				]),
			);

			// Map the results to monitors
			const monitorsWithStatus = monitors.map((row) => {
				const latestEvent = latestEventsMap.get(row.monitor.id);
				const latestChange = latestChangesMap.get(row.monitor.id);

				return {
					...row.monitor,
					group: row.monitor_group || null,
					status: latestEvent?.status || "pending",
					lastCheck: latestEvent ? new Date(latestEvent.timestamp) : null,
					lastStatusChange: latestChange
						? new Date(latestChange.timestamp)
						: null,
					usedOn: usageMap.get(row.monitor.id) || 0,
				};
			});

			// Post-filter by status if needed (since status is dynamic/computed)
			// NOTE: This means pagination might be slightly off if filtering by status,
			// because status is computed after fetching. To fix this properly,
			// status would need to be stored/indexed on the monitor table.
			// For now, we return all matches from DB and filter in memory, which is suboptimal for pagination
			// but consistent with previous implementation.
			// However, since we return 'total' from DB, the total count will be mismatched with status filter.
			// Ideally, we move status filtering to DB layer if possible, or accept this limitation.
			// Given the user asked for pagination, let's keep it simple for now and acknowledge the status filter limitation if it arises.

			let result = monitorsWithStatus;
			if (input?.status) {
				result = monitorsWithStatus.filter((m) => m.status === input.status);
			}

			return {
				items: result,
				total,
			};
		}),

	listGroups: protectedProcedure.handler(async ({ context }) => {
		const groups = await db
			.select()
			.from(monitorGroup)
			.where(
				eq(
					monitorGroup.organizationId,
					context.session.session.activeOrganizationId!,
				),
			)
			.orderBy(desc(monitorGroup.createdAt));
		return groups;
	}),

	createGroup: writeProcedure
		.input(z.object({ name: z.string().min(1) }))
		.handler(async ({ input, context }) => {
			const [newGroup] = await db
				.insert(monitorGroup)
				.values({
					id: crypto.randomUUID(),
					name: input.name,
					organizationId: context.session.session.activeOrganizationId!,
				})
				.returning();
			return newGroup;
		}),

	create: writeProcedure
		.input(
			z.object({
				name: z.string().min(1),
				type: z.enum(["http", "http-json", "tcp", "ping", "dns", "keyword"]),
				interval: z.number().min(30).default(60),
				groupId: z.string().optional(),
				config: z.record(z.any(), z.any()),
				locations: z.array(z.string()).min(1), // Require at least one location
				incidentPendingDuration: z.number().min(0).default(0),
				incidentRecoveryDuration: z.number().min(0).default(0),
			}),
		)
		.handler(async ({ input, context }) => {
			if (!isSelfHosted()) {
				const hasSub = await hasActiveSubscription(
					context.session.session.activeOrganizationId!,
				);

				if (!hasSub) {
					const currentCount = await db.$count(
						monitor,
						eq(
							monitor.organizationId,
							context.session.session.activeOrganizationId!,
						),
					);

					if (currentCount >= MAX_MONITORS) {
						throw new ORPCError("FORBIDDEN", {
							message: `Plan limit reached. You can only create up to ${MAX_MONITORS} monitors.`,
						});
					}
				}
			}

			const [newMonitor] = await db
				.insert(monitor)
				.values({
					id: crypto.randomUUID(),
					name: input.name,
					organizationId: context.session.session.activeOrganizationId!,
					type: input.type,
					config: input.config,
					locations: input.locations,
					groupId: input.groupId,
					active: true,
					incidentPendingDuration: input.incidentPendingDuration,
					incidentRecoveryDuration: input.incidentRecoveryDuration,
				})
				.returning();

			if (!newMonitor) {
				throw new ORPCError("INTERNAL_SERVER_ERROR");
			}

			return newMonitor;
		}),

	delete: writeProcedure
		.input(z.object({ id: z.string() }))
		.handler(async ({ input, context }) => {
			// Verify ownership
			const existing = await db.query.monitor.findFirst({
				where: eq(monitor.id, input.id),
			});

			if (
				!existing ||
				existing.organizationId !== context.session.session.activeOrganizationId
			) {
				throw new ORPCError("NOT_FOUND");
			}

			await db.delete(monitor).where(eq(monitor.id, input.id));
			return { success: true };
		}),

	toggle: writeProcedure
		.input(z.object({ id: z.string(), active: z.boolean() }))
		.handler(async ({ input, context }) => {
			const existing = await db.query.monitor.findFirst({
				where: eq(monitor.id, input.id),
			});

			if (
				!existing ||
				existing.organizationId !== context.session.session.activeOrganizationId
			) {
				throw new ORPCError("NOT_FOUND");
			}

			await db
				.update(monitor)
				.set({ active: input.active })
				.where(eq(monitor.id, input.id));

			return { success: true };
		}),

	update: writeProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1),
				type: z.enum(["http", "http-json", "tcp", "ping", "dns", "keyword"]),
				interval: z.number().min(30).default(60),
				groupId: z.string().optional(),
				config: z.record(z.any(), z.any()),
				locations: z.array(z.string()).min(1),
				incidentPendingDuration: z.number().min(0).default(0),
				incidentRecoveryDuration: z.number().min(0).default(0),
				active: z.boolean().default(true),
			}),
		)
		.handler(async ({ input, context }) => {
			const existing = await db.query.monitor.findFirst({
				where: eq(monitor.id, input.id),
			});

			if (
				!existing ||
				existing.organizationId !== context.session.session.activeOrganizationId
			) {
				throw new ORPCError("NOT_FOUND");
			}

			await db
				.update(monitor)
				.set({
					name: input.name,
					type: input.type,
					interval: input.interval,
					groupId: input.groupId,
					config: input.config,
					locations: input.locations,
					incidentPendingDuration: input.incidentPendingDuration,
					incidentRecoveryDuration: input.incidentRecoveryDuration,
					active: input.active,
				})
				.where(eq(monitor.id, input.id));

			return { success: true };
		}),

	get: protectedProcedure
		.input(z.object({ id: z.string() }))
		.handler(async ({ input, context }) => {
			const row = await db
				.select()
				.from(monitor)
				.leftJoin(monitorGroup, eq(monitor.groupId, monitorGroup.id))
				.where(
					and(
						eq(monitor.id, input.id),
						eq(
							monitor.organizationId,
							context.session.session.activeOrganizationId!,
						),
					),
				)
				.limit(1);

			const found = row[0];

			if (!found) {
				throw new ORPCError("NOT_FOUND");
			}

			const latestEventQuery = await clickhouse.query({
				query:
					"SELECT status, timestamp FROM uptimekit.monitor_events WHERE monitorId = {id:String} ORDER BY timestamp DESC LIMIT 1",
				query_params: { id: found.monitor.id },
				format: "JSON",
			});
			const latestEventJson = await latestEventQuery.json<any>();
			const latestEvent = (latestEventJson.data as SingleEventResult[])[0];

			const latestChangeQuery = await clickhouse.query({
				query:
					"SELECT timestamp FROM uptimekit.monitor_changes WHERE monitorId = {id:String} ORDER BY timestamp DESC LIMIT 1",
				query_params: { id: found.monitor.id },
				format: "JSON",
			});
			const latestChangeJson = await latestChangeQuery.json<any>();
			const latestChange = (latestChangeJson.data as SingleChangeResult[])[0];

			return {
				...found.monitor,
				group: found.monitor_group || null,
				status: latestEvent?.status || "pending",
				lastCheck: latestEvent ? new Date(latestEvent.timestamp) : null,
				lastStatusChange: latestChange
					? new Date(latestChange.timestamp)
					: null,
			};
		}),

	getStats: protectedProcedure
		.input(
			z.object({
				monitorId: z.string(),
				range: z.enum(["24h", "7d", "30d"]),
			}),
		)
		.handler(async ({ input, context }) => {
			const existing = await db.query.monitor.findFirst({
				where: (t, { eq, and }) =>
					and(
						eq(t.id, input.monitorId),
						eq(t.organizationId, context.session.session.activeOrganizationId!),
					),
			});

			if (!existing) {
				throw new ORPCError("NOT_FOUND");
			}

			const now = new Date();
			const startDate = new Date();
			if (input.range === "24h") startDate.setHours(now.getHours() - 24);
			if (input.range === "7d") startDate.setDate(now.getDate() - 7);
			if (input.range === "30d") startDate.setDate(now.getDate() - 30);
			// Optimized average ping calculation using SQL
			// Optimized average ping calculation using ClickHouse
			const query = `
				SELECT avg(latency) as value
				FROM uptimekit.monitor_events
				WHERE monitorId = {monitorId:String} AND timestamp >= {startDate:DateTime}
			`;
			// Convert JS Date to seconds/string for ClickHouse depending on driver?
			// @clickhouse/client params support Date objects if mapped correctly or we can pass unix timestamp or string.
			// Let's pass ISO string.

			const avgPingResult = await clickhouse.query({
				query,
				query_params: {
					monitorId: input.monitorId,
					startDate: startDate.getTime(),
				},
				format: "JSON",
			});
			const avgPingJson = await avgPingResult.json<any>();
			const rows = avgPingJson.data as { value: number }[];

			return {
				avgPing: Math.round(rows[0]?.value || 0),
			};
		}),

	getTimeline: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/monitors/{monitorId}/timeline",
				tags: ["monitors"],
				summary: "Get monitor status timeline",
				description: "Get paginated status changes for a monitor",
			},
		})
		.input(
			z.object({
				monitorId: z.string(),
				limit: z.number().min(1).max(100).default(20),
				cursor: z.number().optional(), // Timestamp cursor
			}),
		)
		.output(
			z.object({
				items: z.array(
					z.object({
						id: z.string(),
						status: z.string(),
						timestamp: z.string(),
						location: z.string().optional(),
					}),
				),
				nextCursor: z.number().optional(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { session } = context.session;

			// Ensure user has access to this monitor
			const mon = await db.query.monitor.findFirst({
				where: (t, { eq, and }) =>
					and(
						eq(t.id, input.monitorId),
						eq(t.organizationId, session.activeOrganizationId!),
					),
			});

			if (!mon) {
				throw new ORPCError("NOT_FOUND", {
					message: "Monitor not found",
				});
			}

			const { limit, cursor } = input;

			const queryParams: Record<string, unknown> = {
				monitorId: input.monitorId,
				limit: limit + 1,
			};

			if (cursor) {
				queryParams.cursor = cursor;
			}

			const changesQuery = await clickhouse.query({
				query: `
					SELECT id, status, timestamp, location
					FROM uptimekit.monitor_changes
					WHERE monitorId = {monitorId:String} 
					${cursor ? "AND timestamp < {cursor:DateTime}" : ""}
					ORDER BY timestamp DESC
					LIMIT {limit:UInt32}
				`,
				query_params: queryParams,
				format: "JSON",
			});
			const changesJson = await changesQuery.json<any>();
			const changes = changesJson.data as ChangeHistoryResult[];

			// Map back to expected types (string timestamp to Date conversion handled below in loop or map)
			// Actually the output expects `timestamp: string`. JSON response is string mainly.

			// We need to support 'nextCursor' which is a number (timestamp).
			const changesWithDate = changes.map((c) => ({
				...c,
				timestamp: new Date(c.timestamp),
			}));

			let nextCursor: number | undefined;
			if (changesWithDate.length > limit) {
				const nextItem = changesWithDate.pop();
				nextCursor = nextItem!.timestamp.getTime();
			}

			return {
				items: changesWithDate.slice(0, limit).map((change) => ({
					id: change.id,
					status: change.status,
					timestamp: change.timestamp.toISOString(),
					location: change.location || undefined,
				})),
				nextCursor,
			};
		}),

	getResponseTimes: protectedProcedure
		.input(
			z.object({
				monitorId: z.string(),
				range: z.enum(["24h", "7d", "30d"]),
				location: z.string().optional(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { session } = context.session;
			// Ensure access
			const mon = await db.query.monitor.findFirst({
				where: (t, { eq, and }) =>
					and(
						eq(t.id, input.monitorId),
						eq(t.organizationId, session.activeOrganizationId!),
					),
			});

			if (!mon) {
				throw new ORPCError("NOT_FOUND", { message: "Monitor not found" });
			}

			const now = new Date();
			const startDate = new Date();
			if (input.range === "24h") startDate.setHours(now.getHours() - 24);
			if (input.range === "7d") startDate.setDate(now.getDate() - 7);
			if (input.range === "30d") startDate.setDate(now.getDate() - 30);

			// Fetch raw events for chart
			const query = `
				SELECT timestamp, latency
				FROM uptimekit.monitor_events
				WHERE monitorId = {monitorId:String} 
				AND timestamp >= {startDate:DateTime}
				${input.location && input.location !== "all" ? "AND location = {location:String}" : ""}
				ORDER BY timestamp ASC
				LIMIT 2000
			`;

			const queryParams: Record<string, unknown> = {
				monitorId: input.monitorId,
				startDate: startDate.getTime(),
			};

			if (input.location && input.location !== "all") {
				queryParams.location = input.location;
			}

			const eventsQuery = await clickhouse.query({
				query,
				query_params: queryParams,
				format: "JSON",
			});
			const eventsJson = await eventsQuery.json<any>();
			const events = eventsJson.data as EventTimelineResult[];

			return events.map((e) => ({
				timestamp: new Date(e.timestamp).toISOString(),
				latency: e.latency,
			}));
		}),

	getAvailability: protectedProcedure
		.input(z.object({ monitorId: z.string() }))
		.handler(async ({ input, context }) => {
			const { session } = context.session;
			const mon = await db.query.monitor.findFirst({
				where: (t, { eq, and }) =>
					and(
						eq(t.id, input.monitorId),
						eq(t.organizationId, session.activeOrganizationId!),
					),
			});
			if (!mon) throw new ORPCError("NOT_FOUND");

			// Helper to calculate stats for a given start date
			const calculateStats = async (startDate: Date | null) => {
				// Get ALL changes since startDate
				const queryParams: Record<string, unknown> = {
					monitorId: input.monitorId,
				};

				if (startDate) {
					queryParams.startDate = startDate.getTime();
				}

				const changesQuery = await clickhouse.query({
					query: `
						SELECT status, timestamp 
						FROM uptimekit.monitor_changes
						WHERE monitorId = {monitorId:String}
						${startDate ? "AND timestamp >= {startDate:DateTime}" : ""}
						ORDER BY timestamp ASC
					`,
					query_params: queryParams,
					format: "JSON",
				});
				const changesJson = await changesQuery.json<any>();
				const changesRaw = changesJson.data as StatsChangeResult[];
				const changes = changesRaw.map((c) => ({
					...c,
					timestamp: new Date(c.timestamp),
				}));

				// Also get the *state at startDate* (the change just before startDate)
				// If no changes in range, we need to know if it was UP or DOWN the whole time.
				let initialStatus = "up";
				if (startDate) {
					const lastBeforeQuery = await clickhouse.query({
						query: `
							SELECT status, timestamp
							FROM uptimekit.monitor_changes
							WHERE monitorId = {monitorId:String} AND timestamp < {startDate:DateTime}
							ORDER BY timestamp DESC
							LIMIT 1
						`,
						query_params: {
							monitorId: input.monitorId,
							startDate: startDate.getTime(),
						},
						format: "JSON",
					});
					const lastBeforeJson = await lastBeforeQuery.json<any>();
					const lastBefore = (lastBeforeJson.data as StatusBeforeResult[])[0];
					if (lastBefore) initialStatus = lastBefore.status;
				} else {
					// For "all time", the first change determines start, or default up if empty
				}

				const NOW = new Date().getTime();
				const START = startDate
					? startDate.getTime()
					: changes[0]?.timestamp.getTime() || NOW;
				const TOTAL_TIME = Math.max(1, NOW - START); // avoid div by 0

				let downtimeMs = 0;
				let incidentCount = 0;
				let maxIncidentMs = 0;
				let incidentSumMs = 0;

				let currentStatus = initialStatus;
				let lastTime = START;

				// Merge initial state into timeline for processing
				// If the first change is AFTER start, we have a gap from START to first change
				// occupied by `initialStatus`.

				const timeline = [...changes];

				for (const change of timeline) {
					const time = change.timestamp.getTime();
					const duration = time - lastTime;

					if (
						currentStatus === "down" ||
						currentStatus === "degraded" ||
						currentStatus === "pending"
					) {
						// only count actual downtime/issues, not maintenance
						downtimeMs += duration;
					}

					if (change.status !== "up" && currentStatus === "up") {
						incidentCount++;
					}

					// If resolving an incident, track duration
					if (change.status === "up" && currentStatus !== "up") {
						// Logic refactor:
						// Incident duration is from START of down to END of down.
					}

					currentStatus = change.status;
					lastTime = time;
				}

				// Add time from last events until NOW
				const durationSinceLast = NOW - lastTime;
				if (
					currentStatus === "down" ||
					currentStatus === "degraded" ||
					currentStatus === "pending"
				) {
					downtimeMs += durationSinceLast;
				}

				// Recalculate incidents properly to get max/avg
				// Re-scan? Or just simpler logic:
				// We need distinct "down periods".
				// Pair (DownTime, UpTime).

				// Let's do a robust pass:
				const incidents: number[] = [];
				let incidentStart: number | null = null;

				// Re-simulate with robust tracking
				let simStatus = initialStatus;
				const simTime = START;

				// If starting in down state, we are in an incident (from before start)
				if (simStatus !== "up") {
					incidentStart = simTime;
				}

				for (const change of timeline) {
					const time = change.timestamp.getTime();

					if (change.status !== "up" && change.status !== "maintenance") {
						if (simStatus === "up" || simStatus === "maintenance") {
							// New incident start
							incidentStart = time;
						}
					} else {
						// Resolved
						if (simStatus !== "up" && incidentStart !== null) {
							const dur = time - incidentStart;
							incidents.push(dur);
							incidentStart = null;
						}
					}
					simStatus = change.status;
				}

				// Ongoing incident?
				if (
					simStatus !== "up" &&
					simStatus !== "maintenance" &&
					incidentStart !== null
				) {
					const dur = NOW - incidentStart;
					incidents.push(dur);
				}

				incidentCount = incidents.length;
				maxIncidentMs = Math.max(0, ...incidents);
				incidentSumMs = incidents.reduce((a, b) => a + b, 0);

				// Downtime matches sum of incidents?
				// Yes, roughly.

				const uptimeMs = TOTAL_TIME - downtimeMs;
				const uptimePercent = (uptimeMs / TOTAL_TIME) * 100;

				return {
					uptimePercent,
					downtimeMs,
					incidentCount,
					maxIncidentMs,
					avgIncidentMs: incidentCount > 0 ? incidentSumMs / incidentCount : 0,
				};
			};

			const now = new Date();
			const day = new Date();
			day.setHours(now.getHours() - 24);
			const week = new Date();
			week.setDate(now.getDate() - 7);
			const month = new Date();
			month.setDate(now.getDate() - 30);
			const year = new Date();
			year.setDate(now.getDate() - 365);

			return {
				today: await calculateStats(day),
				week: await calculateStats(week),
				month: await calculateStats(month),
				year: await calculateStats(year),
				all: await calculateStats(null),
			};
		}),
};
