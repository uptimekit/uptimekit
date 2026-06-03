/** biome-ignore-all lint/style/noNonNullAssertion: shhhh */
import { ORPCError } from "@orpc/server";
import { db, timeseries } from "@uptimekit/db";
import {
	incident,
	incidentActivity,
	incidentMonitor,
} from "@uptimekit/db/schema/incidents";
import {
	integrationConfig,
	monitorNotification,
} from "@uptimekit/db/schema/integrations";
import { monitor, monitorGroup } from "@uptimekit/db/schema/monitors";
import { statusPageMonitor } from "@uptimekit/db/schema/status-pages";
import { monitorTag, tag } from "@uptimekit/db/schema/tags";
import { worker } from "@uptimekit/db/schema/workers";
import {
	and,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	isNull,
	lte,
	or,
	sql,
} from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, writeProcedure } from "../index";
import { insertMonitor } from "../lib/insert-monitor";
import {
	getAggregateMonitorStatusesForMonitors,
	getAggregateMonitorStatusForMonitor,
} from "../lib/monitor-status";
import {
	monitorTimingSchema,
	withMonitorTimingRelations,
} from "../lib/monitor-timing";
import {
	enforceMonitorQuotaOrThrow,
	getOrganizationQuotaState,
} from "../lib/organization-limits";

const RESPONSE_TIME_RANGE_VALUES = [
	"3h",
	"24h",
	"7d",
	"30d",
	"3mo",
	"6mo",
	"1y",
	"all",
] as const;
const responseTimeRangeSchema = z.enum(RESPONSE_TIME_RANGE_VALUES);
type ResponseTimeRange = (typeof RESPONSE_TIME_RANGE_VALUES)[number];

const URL_MONITOR_TYPES = new Set(["http", "http-json", "keyword"]);

function isHttpUrl(value: unknown) {
	if (typeof value !== "string") {
		return false;
	}

	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}

function assertSafeMonitorUrlConfig(
	type: string,
	config: Record<string, unknown>,
) {
	if (!URL_MONITOR_TYPES.has(type)) {
		return;
	}

	if (!isHttpUrl(config.url)) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Monitor URL must use HTTP or HTTPS.",
		});
	}
}

function getResponseTimeRangeStart(
	range: ResponseTimeRange,
	allTimeStartDate?: Date,
) {
	const startDate = new Date();

	switch (range) {
		case "3h":
			startDate.setHours(startDate.getHours() - 3);
			return startDate;
		case "24h":
			startDate.setHours(startDate.getHours() - 24);
			return startDate;
		case "7d":
			startDate.setDate(startDate.getDate() - 7);
			return startDate;
		case "30d":
			startDate.setDate(startDate.getDate() - 30);
			return startDate;
		case "3mo":
			startDate.setMonth(startDate.getMonth() - 3);
			return startDate;
		case "6mo":
			startDate.setMonth(startDate.getMonth() - 6);
			return startDate;
		case "1y":
			startDate.setFullYear(startDate.getFullYear() - 1);
			return startDate;
		case "all":
			return allTimeStartDate ? new Date(allTimeStartDate) : new Date(0);
	}

	return startDate;
}

async function getWorkersForMonitorAssignments(input: {
	workerIds?: string[] | null;
	locations?: string[] | null;
	options?: { activeOnly?: boolean; requireAll?: boolean };
}) {
	const workerIds = input.workerIds ?? [];
	const locations = input.locations ?? [];
	if (workerIds.length === 0 && locations.length === 0) {
		return [];
	}

	const activeOnly = input.options?.activeOnly ?? false;
	const requireAll = input.options?.requireAll ?? false;

	if (workerIds.length > 0) {
		const uniqueWorkerIds = [...new Set(workerIds)];
		const workers = await db
			.select({
				id: worker.id,
				name: worker.name,
				location: worker.location,
			})
			.from(worker)
			.where(
				activeOnly
					? and(inArray(worker.id, uniqueWorkerIds), eq(worker.active, true))
					: inArray(worker.id, uniqueWorkerIds),
			);

		if (requireAll && workers.length !== uniqueWorkerIds.length) {
			throw new ORPCError("BAD_REQUEST", {
				message: "One or more selected workers are missing or inactive.",
			});
		}

		const workersById = new Map(
			workers.map((workerRecord) => [workerRecord.id, workerRecord]),
		);

		return uniqueWorkerIds
			.map((workerId) => workersById.get(workerId))
			.filter((workerRecord) => workerRecord !== undefined);
	}

	const uniqueLocations = [...new Set(locations)];
	const workers = await db
		.select({
			id: worker.id,
			name: worker.name,
			location: worker.location,
		})
		.from(worker)
		.where(
			activeOnly
				? and(
						inArray(worker.location, uniqueLocations),
						eq(worker.active, true),
					)
				: inArray(worker.location, uniqueLocations),
		);

	if (requireAll && workers.length !== uniqueLocations.length) {
		throw new ORPCError("BAD_REQUEST", {
			message: "One or more selected workers are missing or inactive.",
		});
	}

	return workers;
}

async function getDefaultNotificationIds(organizationId: string) {
	const defaults = await db
		.select({ id: integrationConfig.id })
		.from(integrationConfig)
		.where(
			and(
				eq(integrationConfig.organizationId, organizationId),
				eq(integrationConfig.active, true),
				eq(integrationConfig.isDefault, true),
			),
		);

	return defaults.map((item) => item.id);
}

async function assertNotificationIdsForOrganization(input: {
	organizationId: string;
	notificationIds: string[];
}) {
	const uniqueNotificationIds = [...new Set(input.notificationIds)];

	if (uniqueNotificationIds.length === 0) {
		return [];
	}

	const matchingNotifications = await db
		.select({ id: integrationConfig.id })
		.from(integrationConfig)
		.where(
			and(
				eq(integrationConfig.organizationId, input.organizationId),
				inArray(integrationConfig.id, uniqueNotificationIds),
			),
		);

	if (matchingNotifications.length !== uniqueNotificationIds.length) {
		throw new ORPCError("BAD_REQUEST", {
			message: "One or more selected notifications are missing.",
		});
	}

	return uniqueNotificationIds;
}

async function resolveNotificationIdsForCreate(input: {
	organizationId: string;
	notificationIds?: string[];
}) {
	if (input.notificationIds === undefined) {
		return getDefaultNotificationIds(input.organizationId);
	}

	return assertNotificationIdsForOrganization({
		organizationId: input.organizationId,
		notificationIds: input.notificationIds,
	});
}

async function assertGroupForOrganization(input: {
	groupId: string;
	organizationId: string;
}) {
	const group = await db.query.monitorGroup.findFirst({
		where: eq(monitorGroup.id, input.groupId),
	});

	if (!group || group.organizationId !== input.organizationId) {
		throw new ORPCError("BAD_REQUEST", {
			message: "The selected group does not exist.",
		});
	}

	return group;
}

async function getOrganizationGroups(organizationId: string) {
	return db
		.select({ id: monitorGroup.id, parentId: monitorGroup.parentId })
		.from(monitorGroup)
		.where(eq(monitorGroup.organizationId, organizationId));
}

function collectGroupAndDescendantIds(
	rootId: string,
	groups: { id: string; parentId: string | null }[],
) {
	const childrenByParent = new Map<string, string[]>();
	for (const group of groups) {
		if (!group.parentId) continue;
		const siblings = childrenByParent.get(group.parentId) ?? [];
		siblings.push(group.id);
		childrenByParent.set(group.parentId, siblings);
	}

	const result: string[] = [];
	const stack = [rootId];
	while (stack.length > 0) {
		const current = stack.pop()!;
		result.push(current);
		const children = childrenByParent.get(current);
		if (children) {
			stack.push(...children);
		}
	}

	return result;
}

function assertNoGroupCycle(input: {
	groupId: string;
	parentId: string;
	groups: { id: string; parentId: string | null }[];
}) {
	if (input.groupId === input.parentId) {
		throw new ORPCError("BAD_REQUEST", {
			message: "A group cannot be its own parent.",
		});
	}

	const descendantIds = collectGroupAndDescendantIds(
		input.groupId,
		input.groups,
	);
	if (descendantIds.includes(input.parentId)) {
		throw new ORPCError("BAD_REQUEST", {
			message: "A group cannot be moved into one of its own subgroups.",
		});
	}
}

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
					groupId: z.string().optional(),
					tagId: z.string().optional(),
					limit: z.number().default(50),
					offset: z.number().default(0),
				})
				.optional(),
		)
		.route({
			method: "GET",
			path: "/monitors",
			tags: ["Monitor Management"],
			summary: "List monitors",
			description:
				"Retrieve a list of monitors with optional filtering by status, type, and search query.",
		})
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

			if (input?.groupId) {
				const groupIds = collectGroupAndDescendantIds(
					input.groupId,
					await getOrganizationGroups(
						context.session.session.activeOrganizationId!,
					),
				);
				filters.push(inArray(monitor.groupId, groupIds));
			}

			if (input?.tagId) {
				filters.push(
					inArray(
						monitor.id,
						db
							.select({ monitorId: monitorTag.monitorId })
							.from(monitorTag)
							.where(eq(monitorTag.tagId, input.tagId)),
					),
				);
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

			const monitorIds = monitors.map((row) => row.monitor.id);
			const createEmptyMonitorState = () => ({
				latestEventsMap: new Map<string, { status: string; timestamp: Date }>(),
				latestChangesMap: new Map<string, { timestamp: Date }>(),
				aggregateStatusesMap: new Map<
					string,
					{ status: string; statusReason: string | null }
				>(),
			});

			const loadMonitorState = async () => {
				const monitorState = createEmptyMonitorState();

				try {
					const monitorStatusInputs = monitors.map((row) => ({
						id: row.monitor.id,
						workerIds: (row.monitor.workerIds as string[] | null) ?? [],
						locations: (row.monitor.locations as string[] | null) ?? [],
					}));
					const [latestEvents, latestChanges, aggregateStatuses] =
						await Promise.all([
							timeseries.getLatestEventsForMonitors(monitorIds),
							timeseries.getLatestChangesForMonitors(monitorIds),
							getAggregateMonitorStatusesForMonitors(monitorStatusInputs),
						]);

					for (const event of latestEvents) {
						monitorState.latestEventsMap.set(event.monitorId, {
							status: event.status,
							timestamp: event.timestamp,
						});
					}

					for (const change of latestChanges) {
						monitorState.latestChangesMap.set(change.monitorId, {
							timestamp: change.timestamp,
						});
					}

					for (const [monitorId, aggregateStatus] of aggregateStatuses) {
						monitorState.aggregateStatusesMap.set(monitorId, {
							status: aggregateStatus.status,
							statusReason: aggregateStatus.statusReason,
						});
					}
				} catch (error) {
					console.error(
						"[monitors.list] Failed to load latest monitor state from time-series store",
						error,
					);
				}

				return monitorState;
			};

			const [
				usageCounts,
				notificationCounts,
				tagsForMonitors,
				activeIncidentLinks,
				{ latestEventsMap, latestChangesMap, aggregateStatusesMap },
			] =
				monitorIds.length > 0
					? await Promise.all([
							db
								.select({
									monitorId: statusPageMonitor.monitorId,
									count: sql<number>`count(*)`.mapWith(Number),
								})
								.from(statusPageMonitor)
								.where(inArray(statusPageMonitor.monitorId, monitorIds))
								.groupBy(statusPageMonitor.monitorId),
							db
								.select({
									monitorId: monitorNotification.monitorId,
									count: sql<number>`count(*)`.mapWith(Number),
								})
								.from(monitorNotification)
								.where(inArray(monitorNotification.monitorId, monitorIds))
								.groupBy(monitorNotification.monitorId),
							db
								.select({
									monitorId: monitorTag.monitorId,
									tag: tag,
								})
								.from(monitorTag)
								.innerJoin(tag, eq(monitorTag.tagId, tag.id))
								.where(inArray(monitorTag.monitorId, monitorIds)),
							db
								.select({
									monitorId: incidentMonitor.monitorId,
									incidentId: incident.id,
								})
								.from(incidentMonitor)
								.innerJoin(
									incident,
									eq(incidentMonitor.incidentId, incident.id),
								)
								.where(
									and(
										inArray(incidentMonitor.monitorId, monitorIds),
										eq(
											incident.organizationId,
											context.session.session.activeOrganizationId!,
										),
										isNull(incident.endedAt),
									),
								),
							loadMonitorState(),
						])
					: [[], [], [], [], createEmptyMonitorState()];

			const usageMap = new Map(usageCounts.map((c) => [c.monitorId, c.count]));
			const notificationCountMap = new Map(
				notificationCounts.map((item) => [item.monitorId, item.count]),
			);
			const activeIncidentMap = new Map(
				activeIncidentLinks.map((item) => [item.monitorId, item.incidentId]),
			);

			const tagsByMonitor = new Map<string, (typeof tag.$inferSelect)[]>();
			for (const { monitorId, tag: tagRecord } of tagsForMonitors) {
				if (!tagsByMonitor.has(monitorId)) {
					tagsByMonitor.set(monitorId, []);
				}
				tagsByMonitor.get(monitorId)?.push(tagRecord);
			}

			// Map the results to monitors
			const monitorsWithStatus = monitors.map((row) => {
				const latestEvent = latestEventsMap.get(row.monitor.id);
				const latestChange = latestChangesMap.get(row.monitor.id);
				const aggregateStatus = aggregateStatusesMap.get(row.monitor.id);

				return {
					...row.monitor,
					group: row.monitor_group || null,
					tags: tagsByMonitor.get(row.monitor.id) || [],
					status: aggregateStatus?.status || latestEvent?.status || "pending",
					statusReason: aggregateStatus?.statusReason ?? null,
					lastCheck: latestEvent?.timestamp ?? null,
					lastStatusChange: latestChange?.timestamp ?? null,
					usedOn: usageMap.get(row.monitor.id) || 0,
					notificationCount: notificationCountMap.get(row.monitor.id) || 0,
					activeIncidentId: activeIncidentMap.get(row.monitor.id) ?? null,
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

	listGroups: protectedProcedure
		.route({
			method: "GET",
			path: "/monitors/groups",
			tags: ["Monitor Management"],
			summary: "List monitor groups",
			description: "Retrieve all monitor groups.",
		})
		.handler(async ({ context }) => {
			const groups = await db
				.select()
				.from(monitorGroup)
				.where(
					eq(
						monitorGroup.organizationId,
						context.session.session.activeOrganizationId!,
					),
				)
				.orderBy(monitorGroup.name);
			return groups;
		}),

	createGroup: writeProcedure
		.route({
			method: "POST",
			path: "/monitors/groups",
			tags: ["Monitor Management"],
			summary: "Create monitor group",
			description: "Create a new group for organizing monitors.",
		})
		.input(
			z.object({ name: z.string().min(1), parentId: z.string().nullish() }),
		)
		.handler(async ({ input, context }) => {
			const organizationId = context.session.session.activeOrganizationId!;

			if (input.parentId) {
				await assertGroupForOrganization({
					groupId: input.parentId,
					organizationId,
				});
			}

			const [newGroup] = await db
				.insert(monitorGroup)
				.values({
					id: crypto.randomUUID(),
					name: input.name,
					parentId: input.parentId ?? null,
					organizationId,
				})
				.returning();
			return newGroup;
		}),

	create: writeProcedure
		.route({
			method: "POST",
			path: "/monitors",
			tags: ["Monitor Management"],
			summary: "Create monitor",
			description: "Create a new monitor with specified configuration.",
		})
		.input(
			withMonitorTimingRelations(
				z.object({
					name: z.string().min(1),
					type: z.enum(["http", "http-json", "tcp", "ping", "dns", "keyword"]),
					...monitorTimingSchema,
					groupId: z.string().nullish(),
					tags: z.array(z.string()).optional(),
					config: z.record(z.any(), z.any()),
					workerIds: z.array(z.string()).min(1),
					notificationIds: z.array(z.string()).optional(),
					incidentPendingDuration: z.number().min(0).default(0),
					incidentRecoveryDuration: z.number().min(0).default(0),
					publishIncidentToStatusPage: z.boolean().default(false),
				}),
			),
		)
		.handler(async ({ input, context }) => {
			const organizationId = context.session.session.activeOrganizationId!;
			assertSafeMonitorUrlConfig(input.type, input.config);

			if (input.groupId) {
				await assertGroupForOrganization({
					groupId: input.groupId,
					organizationId,
				});
			}

			await enforceMonitorQuotaOrThrow({
				organizationId,
				nextWorkerIds: input.workerIds,
				nextActive: true,
			});

			const selectedWorkers = await getWorkersForMonitorAssignments({
				workerIds: input.workerIds,
				options: {
					activeOnly: true,
					requireAll: true,
				},
			});

			const notificationIds = await resolveNotificationIdsForCreate({
				organizationId,
				notificationIds: input.notificationIds,
			});

			const newMonitor = await db.transaction(async (tx) =>
				insertMonitor(tx, {
					organizationId,
					name: input.name,
					type: input.type,
					interval: input.interval,
					timeout: input.timeout,
					retries: input.retries,
					retryInterval: input.retryInterval,
					config: input.config,
					locations: selectedWorkers.map(
						(selectedWorker) => selectedWorker.location,
					),
					workerIds: input.workerIds,
					groupId: input.groupId ?? null,
					active: true,
					incidentPendingDuration: input.incidentPendingDuration,
					incidentRecoveryDuration: input.incidentRecoveryDuration,
					publishIncidentToStatusPage: input.publishIncidentToStatusPage,
					tagIds: input.tags ?? [],
					notificationIds,
				}),
			);

			return newMonitor;
		}),

	delete: writeProcedure
		.route({
			method: "DELETE",
			path: "/monitors/{id}",
			tags: ["Monitor Management"],
			summary: "Delete monitor",
			description: "Delete a specific monitor by ID.",
		})
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

			const now = new Date();

			// Find all active incidents associated with this monitor
			const activeIncidentLinks = await db
				.select({
					incidentId: incidentMonitor.incidentId,
				})
				.from(incidentMonitor)
				.innerJoin(incident, eq(incidentMonitor.incidentId, incident.id))
				.where(
					and(
						eq(incidentMonitor.monitorId, input.id),
						isNull(incident.endedAt),
					),
				);

			// Resolve all active incidents before deleting the monitor
			if (activeIncidentLinks.length > 0) {
				const incidentIds = activeIncidentLinks.map((link) => link.incidentId);

				await db.transaction(async (tx) => {
					// Update all active incidents to resolved
					for (const incidentId of incidentIds) {
						await tx
							.update(incident)
							.set({
								status: "resolved",
								endedAt: now,
								resolvedAt: now,
								updatedAt: now,
							})
							.where(eq(incident.id, incidentId));

						// Add activity log for each incident
						await tx.insert(incidentActivity).values({
							id: crypto.randomUUID(),
							incidentId,
							message: `Incident automatically resolved due to monitor "${existing.name}" being deleted`,
							type: "event",
							createdAt: now,
							userId: context.session.user.id,
						});
					}
				});
			}

			await db.delete(monitor).where(eq(monitor.id, input.id));
			return { success: true };
		}),

	toggle: writeProcedure
		.route({
			method: "POST",
			path: "/monitors/{id}/toggle",
			tags: ["Monitor Management"],
			summary: "Toggle monitor status",
			description: "Enable or disable a specific monitor.",
		})
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

			if (input.active) {
				const existingWorkerIds = (existing.workerIds as string[] | null) ?? [];

				if (existingWorkerIds.length === 0) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"Monitor has no assigned workers. Select at least one worker before re-enabling it.",
					});
				}

				await enforceMonitorQuotaOrThrow({
					organizationId: existing.organizationId,
					nextWorkerIds: existingWorkerIds,
					nextActive: true,
					excludeMonitorId: existing.id,
				});
			}

			await db
				.update(monitor)
				.set({
					active: input.active,
					pauseReason: null,
				})
				.where(eq(monitor.id, input.id));

			return { success: true };
		}),

	update: writeProcedure
		.route({
			method: "PATCH",
			path: "/monitors/{id}",
			tags: ["Monitor Management"],
			summary: "Update monitor",
			description: "Update the configuration of an existing monitor.",
		})
		.input(
			withMonitorTimingRelations(
				z.object({
					id: z.string(),
					name: z.string().min(1),
					type: z.enum(["http", "http-json", "tcp", "ping", "dns", "keyword"]),
					...monitorTimingSchema,
					groupId: z.string().nullish(),
					tags: z.array(z.string()).optional(),
					config: z.record(z.any(), z.any()),
					workerIds: z.array(z.string()).min(1),
					notificationIds: z.array(z.string()).optional(),
					incidentPendingDuration: z.number().min(0).default(0),
					incidentRecoveryDuration: z.number().min(0).default(0),
					publishIncidentToStatusPage: z.boolean().default(false),
					active: z.boolean().default(true),
				}),
			),
		)
		.handler(async ({ input, context }) => {
			assertSafeMonitorUrlConfig(input.type, input.config);

			const existing = await db.query.monitor.findFirst({
				where: eq(monitor.id, input.id),
			});

			if (
				!existing ||
				existing.organizationId !== context.session.session.activeOrganizationId
			) {
				throw new ORPCError("NOT_FOUND");
			}

			if (input.groupId) {
				await assertGroupForOrganization({
					groupId: input.groupId,
					organizationId: existing.organizationId,
				});
			}

			await enforceMonitorQuotaOrThrow({
				organizationId: existing.organizationId,
				nextWorkerIds: input.workerIds,
				nextActive: input.active,
				excludeMonitorId: existing.id,
			});

			const selectedWorkers = await getWorkersForMonitorAssignments({
				workerIds: input.workerIds,
				options: {
					activeOnly: true,
					requireAll: true,
				},
			});

			const notificationIds =
				input.notificationIds === undefined
					? undefined
					: await assertNotificationIdsForOrganization({
							organizationId: existing.organizationId,
							notificationIds: input.notificationIds,
						});

			await db.transaction(async (tx) => {
				await tx
					.update(monitor)
					.set({
						name: input.name,
						type: input.type,
						interval: input.interval,
						timeout: input.timeout,
						retries: input.retries,
						retryInterval: input.retryInterval,
						groupId: input.groupId,
						config: input.config,
						locations: selectedWorkers.map(
							(selectedWorker) => selectedWorker.location,
						),
						workerIds: input.workerIds,
						incidentPendingDuration: input.incidentPendingDuration,
						incidentRecoveryDuration: input.incidentRecoveryDuration,
						publishIncidentToStatusPage: input.publishIncidentToStatusPage,
						active: input.active,
						pauseReason: null,
					})
					.where(eq(monitor.id, input.id));

				if (input.tags) {
					// Remove existing tags
					await tx.delete(monitorTag).where(eq(monitorTag.monitorId, input.id));

					// Add new tags
					if (input.tags.length > 0) {
						await tx.insert(monitorTag).values(
							input.tags.map((tagId) => ({
								monitorId: input.id,
								tagId,
							})),
						);
					}
				}

				if (notificationIds !== undefined) {
					await tx
						.delete(monitorNotification)
						.where(eq(monitorNotification.monitorId, input.id));

					if (notificationIds.length > 0) {
						await tx.insert(monitorNotification).values(
							notificationIds.map((notificationId) => ({
								monitorId: input.id,
								integrationConfigId: notificationId,
							})),
						);
					}
				}
			});

			return { success: true };
		}),

	bulkAssignWorkers: writeProcedure
		.route({
			method: "POST",
			path: "/monitors/bulk-assign-workers",
			tags: ["Monitor Management"],
			summary: "Bulk assign workers to monitors",
			description:
				"Add or replace one or more workers across multiple monitors in one operation.",
		})
		.input(
			z.object({
				monitorIds: z.array(z.string()).min(1),
				workerIds: z.array(z.string()).min(1),
				mode: z.enum(["add", "replace"]),
			}),
		)
		.handler(async ({ input, context }) => {
			const organizationId = context.session.session.activeOrganizationId!;
			const monitorIds = [...new Set(input.monitorIds)];
			const selectedWorkerIds = [...new Set(input.workerIds)];

			await getWorkersForMonitorAssignments({
				workerIds: selectedWorkerIds,
				options: { activeOnly: true, requireAll: true },
			});

			const monitors = await db
				.select({
					id: monitor.id,
					workerIds: monitor.workerIds,
				})
				.from(monitor)
				.where(
					and(
						eq(monitor.organizationId, organizationId),
						inArray(monitor.id, monitorIds),
					),
				);

			if (monitors.length !== monitorIds.length) {
				throw new ORPCError("NOT_FOUND", {
					message: "One or more selected monitors could not be found.",
				});
			}

			const nextWorkerIdsByMonitor = new Map<string, string[]>();
			for (const monitorRecord of monitors) {
				const existingWorkerIds =
					(monitorRecord.workerIds as string[] | null) ?? [];
				const nextWorkerIds =
					input.mode === "replace"
						? selectedWorkerIds
						: [...new Set([...existingWorkerIds, ...selectedWorkerIds])];
				nextWorkerIdsByMonitor.set(monitorRecord.id, nextWorkerIds);
			}

			const quotaState = await getOrganizationQuotaState(organizationId);
			if (quotaState.regionsPerMonitorLimit !== null) {
				const regionLimit = quotaState.regionsPerMonitorLimit;
				const overflowCount = monitors.filter(
					(monitorRecord) =>
						(nextWorkerIdsByMonitor.get(monitorRecord.id)?.length ?? 0) >
						regionLimit,
				).length;

				if (overflowCount > 0) {
					throw new ORPCError("FORBIDDEN", {
						message: `This change would exceed the limit of ${regionLimit} worker(s) per monitor on ${overflowCount} monitor(s). No monitors were updated.`,
					});
				}
			}

			const allWorkerIds = [
				...new Set([...nextWorkerIdsByMonitor.values()].flat()),
			];
			const workerRows = await db
				.select({ id: worker.id, location: worker.location })
				.from(worker)
				.where(inArray(worker.id, allWorkerIds));
			const locationByWorkerId = new Map(
				workerRows.map((workerRow) => [workerRow.id, workerRow.location]),
			);

			await db.transaction(async (tx) => {
				for (const monitorRecord of monitors) {
					const nextWorkerIds =
						nextWorkerIdsByMonitor.get(monitorRecord.id) ?? [];
					const nextLocations = [
						...new Set(
							nextWorkerIds
								.map((workerId) => locationByWorkerId.get(workerId))
								.filter(
									(location): location is string => location !== undefined,
								),
						),
					];

					await tx
						.update(monitor)
						.set({
							workerIds: nextWorkerIds,
							locations: nextLocations,
						})
						.where(eq(monitor.id, monitorRecord.id));
				}
			});

			return { updatedCount: monitors.length };
		}),

	get: protectedProcedure
		.route({
			method: "GET",
			path: "/monitors/{id}",
			tags: ["Monitor Management"],
			summary: "Get monitor",
			description: "Retrieve details of a specific monitor.",
		})
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

			const [latestEvent, latestChange, activeIncidentLink] = await Promise.all(
				[
					timeseries.getLatestEventForMonitor(found.monitor.id),
					timeseries.getLatestChangeForMonitor(found.monitor.id),
					db
						.select({ incidentId: incident.id })
						.from(incidentMonitor)
						.innerJoin(incident, eq(incidentMonitor.incidentId, incident.id))
						.where(
							and(
								eq(incidentMonitor.monitorId, found.monitor.id),
								eq(
									incident.organizationId,
									context.session.session.activeOrganizationId!,
								),
								isNull(incident.endedAt),
							),
						)
						.limit(1),
				],
			);

			// Fetch tags for this monitor
			const monitorTags = await db
				.select({
					tag: tag,
				})
				.from(monitorTag)
				.innerJoin(tag, eq(monitorTag.tagId, tag.id))
				.where(eq(monitorTag.monitorId, found.monitor.id));

			const notifications = await db
				.select({
					id: integrationConfig.id,
					name: integrationConfig.name,
					type: integrationConfig.type,
					active: integrationConfig.active,
					isDefault: integrationConfig.isDefault,
				})
				.from(monitorNotification)
				.innerJoin(
					integrationConfig,
					eq(monitorNotification.integrationConfigId, integrationConfig.id),
				)
				.where(eq(monitorNotification.monitorId, found.monitor.id));

			const monitorWorkerIds =
				(found.monitor.workerIds as string[] | null) ?? [];
			const monitorLocations =
				(found.monitor.locations as string[] | null) ?? [];
			const [monitorWorkers, aggregateStatus] = await Promise.all([
				getWorkersForMonitorAssignments({
					workerIds: monitorWorkerIds,
					locations: monitorLocations,
				}),
				getAggregateMonitorStatusForMonitor({
					id: found.monitor.id,
					workerIds: monitorWorkerIds,
					locations: monitorLocations,
				}),
			]);

			return {
				...found.monitor,
				group: found.monitor_group || null,
				tags: monitorTags.map((mt) => mt.tag),
				notificationIds: notifications.map((notification) => notification.id),
				notifications,
				workers: monitorWorkers,
				status: aggregateStatus.status || latestEvent?.status || "pending",
				statusReason: aggregateStatus.statusReason,
				lastCheck: latestEvent?.timestamp ?? null,
				lastStatusChange: latestChange?.timestamp ?? null,
				activeIncidentId: activeIncidentLink[0]?.incidentId ?? null,
			};
		}),

	getStats: protectedProcedure
		.route({
			method: "GET",
			path: "/monitors/{monitorId}/stats",
			tags: ["Monitor Management"],
			summary: "Get monitor stats",
			description: "Get uptime and latency statistics for a monitor.",
		})
		.input(
			z.object({
				monitorId: z.string(),
				range: responseTimeRangeSchema,
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

			const startDate = getResponseTimeRangeStart(
				input.range,
				existing.createdAt,
			);

			const avgPing = await timeseries.getAverageLatency(
				input.monitorId,
				startDate,
			);

			return {
				avgPing: Math.round(avgPing),
			};
		}),

	getTimeline: protectedProcedure
		.route({
			method: "GET",
			path: "/monitors/{monitorId}/timeline",
			tags: ["Monitor Management"],
			summary: "Get monitor status timeline",
			description: "Get paginated status changes for a monitor",
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

			const changes = await timeseries.getChangeTimeline({
				monitorId: input.monitorId,
				limit: limit + 1,
				cursorBefore: cursor ? new Date(cursor) : undefined,
			});

			const nextCursor =
				changes.length > limit
					? changes[limit]?.timestamp.getTime()
					: undefined;

			return {
				items: changes.slice(0, limit).map((change) => ({
					id: change.id,
					status: change.status,
					timestamp: change.timestamp.toISOString(),
					location: change.location || undefined,
				})),
				nextCursor,
			};
		}),

	getResponseTimes: protectedProcedure
		.route({
			method: "GET",
			path: "/monitors/{monitorId}/response-times",
			tags: ["monitors"],
			summary: "Get response times",
			description: "Retrieve historical response time data for charts.",
		})
		.input(
			z.object({
				monitorId: z.string(),
				range: responseTimeRangeSchema,
				workerIds: z.array(z.string()).optional().default([]),
				allChecks: z.boolean().optional().default(false),
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

			const startDate = getResponseTimeRangeStart(input.range, mon.createdAt);

			const filterLocations =
				input.workerIds.length > 0 && !input.workerIds.includes("all")
					? input.workerIds
					: undefined;

			// Scale the cap by worker count; a single shared cap would shrink the
			// visible time window as more workers compete for the same row budget.
			const workerCount = Math.max(filterLocations?.length ?? 1, 1);
			const limit = input.allChecks ? null : 2000 * workerCount;

			const events = await timeseries.getResponseTimes({
				monitorId: input.monitorId,
				since: startDate,
				locations: filterLocations,
				limit,
			});

			return events.map((e) => ({
				timestamp: e.timestamp.toISOString(),
				location: e.location ?? "",
				latency: e.latency,
				dnsLookup: e.dnsLookup ?? undefined,
				tcpConnect: e.tcpConnect ?? undefined,
				tlsHandshake: e.tlsHandshake ?? undefined,
				ttfb: e.ttfb ?? undefined,
				transfer: e.transfer ?? undefined,
			}));
		}),

	getAvailability: protectedProcedure
		.route({
			method: "GET",
			path: "/monitors/{monitorId}/availability",
			tags: ["monitors"],
			summary: "Get availability",
			description:
				"Calculate availability percentage and incident statistics for a monitor over time.",
		})
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
				const now = Date.now();
				const monitorCreatedAt = mon.createdAt.getTime();
				const periodStart = startDate ? startDate.getTime() : monitorCreatedAt;
				const nowDate = new Date(now);
				const periodStartDate = new Date(periodStart);
				const totalTime = Math.max(1, now - periodStart);

				const incidents = await db
					.select({
						startedAt: incident.startedAt,
						endedAt: incident.endedAt,
					})
					.from(incidentMonitor)
					.innerJoin(incident, eq(incidentMonitor.incidentId, incident.id))
					.where(
						and(
							eq(incidentMonitor.monitorId, input.monitorId),
							eq(incident.organizationId, session.activeOrganizationId!),
							lte(incident.startedAt, nowDate),
							or(
								isNull(incident.endedAt),
								gte(incident.endedAt, periodStartDate),
							),
						),
					)
					.orderBy(incident.startedAt);

				const overlappingDurations = incidents.map((item) => {
					const overlapStart = Math.max(item.startedAt.getTime(), periodStart);
					const overlapEnd = Math.min(
						(item.endedAt ?? new Date(now)).getTime(),
						now,
					);
					return Math.max(0, overlapEnd - overlapStart);
				});

				const downtimeMs = overlappingDurations.reduce(
					(sum, duration) => sum + duration,
					0,
				);
				const incidentCount = overlappingDurations.filter(
					(duration) => duration > 0,
				).length;
				const maxIncidentMs = Math.max(0, ...overlappingDurations);
				const incidentSumMs = overlappingDurations.reduce(
					(sum, duration) => sum + duration,
					0,
				);
				const uptimeMs = Math.max(0, totalTime - downtimeMs);
				const uptimePercent = (uptimeMs / totalTime) * 100;

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

	getBatchLatencySparkline: protectedProcedure
		.input(
			z.object({
				monitorIds: z.array(z.string()),
			}),
		)
		.handler(async ({ input, context }) => {
			const { session } = context.session;
			const monitorIds = [...new Set(input.monitorIds)];

			if (monitorIds.length === 0) {
				return {};
			}

			// Verify access to all requested monitors
			const monitors = await db
				.select({ id: monitor.id })
				.from(monitor)
				.where(
					and(
						inArray(monitor.id, monitorIds),
						eq(monitor.organizationId, session.activeOrganizationId!),
					),
				);

			const accessibleIds = new Set(monitors.map((m) => m.id));
			const filteredIds = monitorIds.filter((id) => accessibleIds.has(id));

			if (filteredIds.length === 0) {
				return {};
			}

			const rows = await timeseries.getRecentLatenciesByMonitor(
				filteredIds,
				20,
			);

			// Group by monitorId
			const sparklineData: Record<string, number[]> = {};
			for (const row of rows) {
				let arr = sparklineData[row.monitorId];
				if (!arr) {
					arr = [];
					sparklineData[row.monitorId] = arr;
				}
				arr.push(row.latency);
			}

			return sparklineData;
		}),

	updateGroup: writeProcedure
		.route({
			method: "PATCH",
			path: "/monitors/groups/{id}",
			tags: ["Monitor Management"],
			summary: "Update monitor group",
			description: "Update the name of an existing monitor group.",
		})
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).optional(),
				parentId: z.string().nullish(),
			}),
		)
		.handler(async ({ input, context }) => {
			const organizationId = context.session.session.activeOrganizationId;
			const existing = await db.query.monitorGroup.findFirst({
				where: eq(monitorGroup.id, input.id),
			});

			if (!existing || existing.organizationId !== organizationId) {
				throw new ORPCError("NOT_FOUND");
			}

			const updates: { name?: string; parentId?: string | null } = {};

			if (input.name !== undefined) {
				updates.name = input.name;
			}

			if (input.parentId !== undefined) {
				if (input.parentId) {
					await assertGroupForOrganization({
						groupId: input.parentId,
						organizationId: existing.organizationId,
					});
					assertNoGroupCycle({
						groupId: input.id,
						parentId: input.parentId,
						groups: await getOrganizationGroups(existing.organizationId),
					});
				}
				updates.parentId = input.parentId ?? null;
			}

			if (Object.keys(updates).length === 0) {
				return existing;
			}

			const [updated] = await db
				.update(monitorGroup)
				.set(updates)
				.where(eq(monitorGroup.id, input.id))
				.returning();

			return updated;
		}),

	deleteGroup: writeProcedure
		.route({
			method: "DELETE",
			path: "/monitors/groups/{id}",
			tags: ["Monitor Management"],
			summary: "Delete monitor group",
			description:
				"Delete a monitor group. Child groups are promoted to the deleted group's parent, and monitors in this group have their groupId set to null.",
		})
		.input(z.object({ id: z.string() }))
		.handler(async ({ input, context }) => {
			const existing = await db.query.monitorGroup.findFirst({
				where: eq(monitorGroup.id, input.id),
			});

			if (
				!existing ||
				existing.organizationId !== context.session.session.activeOrganizationId
			) {
				throw new ORPCError("NOT_FOUND");
			}

			await db.transaction(async (tx) => {
				await tx
					.update(monitorGroup)
					.set({ parentId: existing.parentId })
					.where(eq(monitorGroup.parentId, input.id));

				await tx.delete(monitorGroup).where(eq(monitorGroup.id, input.id));
			});

			return { success: true };
		}),

	listTags: protectedProcedure
		.route({
			method: "GET",
			path: "/monitors/tags",
			tags: ["Monitor Management"],
			summary: "List monitor tags",
			description: "Retrieve all monitor tags.",
		})
		.handler(async ({ context }) => {
			const tags = await db
				.select()
				.from(tag)
				.where(
					eq(tag.organizationId, context.session.session.activeOrganizationId!),
				)
				.orderBy(desc(tag.createdAt));
			return tags;
		}),

	createTag: writeProcedure
		.route({
			method: "POST",
			path: "/monitors/tags",
			tags: ["Monitor Management"],
			summary: "Create monitor tag",
			description: "Create a new tag for organizing monitors.",
		})
		.input(
			z.object({
				name: z.string().min(1),
				color: z.string().default("#3b82f6"),
			}),
		)
		.handler(async ({ input, context }) => {
			const [newTag] = await db
				.insert(tag)
				.values({
					id: crypto.randomUUID(),
					name: input.name,
					color: input.color,
					organizationId: context.session.session.activeOrganizationId!,
				})
				.returning();
			return newTag;
		}),

	updateTag: writeProcedure
		.route({
			method: "PATCH",
			path: "/monitors/tags/{id}",
			tags: ["Monitor Management"],
			summary: "Update monitor tag",
			description: "Update a tag's name or color.",
		})
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).optional(),
				color: z.string().optional(),
			}),
		)
		.handler(async ({ input, context }) => {
			const existing = await db.query.tag.findFirst({
				where: eq(tag.id, input.id),
			});

			if (
				!existing ||
				existing.organizationId !== context.session.session.activeOrganizationId
			) {
				throw new ORPCError("NOT_FOUND");
			}

			const updates: { name?: string; color?: string } = {};
			if (input.name) updates.name = input.name;
			if (input.color) updates.color = input.color;

			const [updated] = await db
				.update(tag)
				.set(updates)
				.where(eq(tag.id, input.id))
				.returning();

			return updated;
		}),

	deleteTag: writeProcedure
		.route({
			method: "DELETE",
			path: "/monitors/tags/{id}",
			tags: ["Monitor Management"],
			summary: "Delete monitor tag",
			description:
				"Delete a tag. This will also remove the tag from all monitors.",
		})
		.input(z.object({ id: z.string() }))
		.handler(async ({ input, context }) => {
			const existing = await db.query.tag.findFirst({
				where: eq(tag.id, input.id),
			});

			if (
				!existing ||
				existing.organizationId !== context.session.session.activeOrganizationId
			) {
				throw new ORPCError("NOT_FOUND");
			}

			await db.delete(tag).where(eq(tag.id, input.id));
			return { success: true };
		}),

	addTagToMonitor: writeProcedure
		.route({
			method: "POST",
			path: "/monitors/{monitorId}/tags/{tagId}",
			tags: ["Monitor Management"],
			summary: "Add tag to monitor",
			description: "Associate a tag with a monitor.",
		})
		.input(z.object({ monitorId: z.string(), tagId: z.string() }))
		.handler(async ({ input, context }) => {
			const mon = await db.query.monitor.findFirst({
				where: eq(monitor.id, input.monitorId),
			});

			if (
				!mon ||
				mon.organizationId !== context.session.session.activeOrganizationId
			) {
				throw new ORPCError("NOT_FOUND", { message: "Monitor not found" });
			}

			const tagRecord = await db.query.tag.findFirst({
				where: eq(tag.id, input.tagId),
			});

			if (
				!tagRecord ||
				tagRecord.organizationId !==
					context.session.session.activeOrganizationId
			) {
				throw new ORPCError("NOT_FOUND", { message: "Tag not found" });
			}

			await db
				.insert(monitorTag)
				.values({
					monitorId: input.monitorId,
					tagId: input.tagId,
				})
				.onConflictDoNothing();

			return { success: true };
		}),

	removeTagFromMonitor: writeProcedure
		.route({
			method: "DELETE",
			path: "/monitors/{monitorId}/tags/{tagId}",
			tags: ["Monitor Management"],
			summary: "Remove tag from monitor",
			description: "Remove a tag association from a monitor.",
		})
		.input(z.object({ monitorId: z.string(), tagId: z.string() }))
		.handler(async ({ input, context }) => {
			const mon = await db.query.monitor.findFirst({
				where: eq(monitor.id, input.monitorId),
			});

			if (
				!mon ||
				mon.organizationId !== context.session.session.activeOrganizationId
			) {
				throw new ORPCError("NOT_FOUND");
			}

			await db
				.delete(monitorTag)
				.where(
					and(
						eq(monitorTag.monitorId, input.monitorId),
						eq(monitorTag.tagId, input.tagId),
					),
				);

			return { success: true };
		}),
	nuke: writeProcedure
		.input(
			z.object({
				monitorId: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const { session } = context.session;

			if (!input.monitorId) {
				return {};
			}

			const monitors = await db
				.select({ id: monitor.id })
				.from(monitor)
				.where(
					and(
						eq(monitor.id, input.monitorId),
						eq(monitor.organizationId, session.activeOrganizationId!),
					),
				);

			if (monitors.length === 0) {
				throw new ORPCError("NOT_FOUND");
			}

			const relatedIncidents = await db
				.select({ id: incident.id })
				.from(incident)
				.innerJoin(incidentMonitor, eq(incident.id, incidentMonitor.incidentId))
				.where(
					and(
						eq(incidentMonitor.monitorId, input.monitorId),
						eq(incident.organizationId, session.activeOrganizationId!),
					),
				);

			await timeseries.deleteAllForMonitor(input.monitorId);

			if (relatedIncidents.length > 0) {
				await db.delete(incident).where(
					and(
						eq(incident.organizationId, session.activeOrganizationId!),
						inArray(
							incident.id,
							relatedIncidents.map((relatedIncident) => relatedIncident.id),
						),
					),
				);
			}

			return {
				success: true,
			};
		}),
};
