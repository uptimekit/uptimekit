import { ORPCError } from "@orpc/server";
import { auth } from "@uptimekit/auth";
import { db } from "@uptimekit/db";
import {
	incident,
	incidentActivity,
	incidentMonitor,
} from "@uptimekit/db/schema/incidents";
import {
	maintenance,
	maintenanceMonitor,
} from "@uptimekit/db/schema/maintenance";
import {
	monitor,
	monitorChange,
	monitorEvent,
} from "@uptimekit/db/schema/monitors";
import { worker } from "@uptimekit/db/schema/workers";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { o, publicProcedure } from "../index";
import { eventBus } from "../lib/events";

const monitorEventInputSchema = z.object({
	monitorId: z.string(),
	status: z.enum(["up", "down", "degraded", "maintenance", "pending"]),
	latency: z.number(),
	timestamp: z.union([z.string(), z.date(), z.number()]),
	statusCode: z.number().optional(),
	error: z.string().optional(),
	location: z.string().optional(),
	locations: z.array(z.string()).optional(),
});

// Middleware to authenticate worker via API Key
const requireWorkerAuth = o.middleware(async ({ context, next }) => {
	const authHeader = context.headers.get("authorization");
	if (!authHeader?.startsWith("Bearer ")) {
		throw new ORPCError("UNAUTHORIZED", {
			message: "Missing or invalid Authorization header",
		});
	}

	const token = authHeader.split(" ")[1];

	if (!token) {
		throw new ORPCError("UNAUTHORIZED", {
			message: "Missing token",
		});
	}

	let apiKeyId: string | null = null;

	try {
		const keyValidation = await auth.api.verifyApiKey({
			headers: context.headers,
			body: {
				key: token,
			},
		});

		if (keyValidation?.key) {
			apiKeyId = keyValidation.key.id;
		}
	} catch (_) {
		// Ignore error and try manual lookup
	}

	if (!apiKeyId) {
		// Fallback: Try manual lookup
		const keyRecord = await db.query.apikey.findFirst({
			where: (t, { eq }) => eq(t.key, token),
		});

		if (keyRecord) {
			apiKeyId = keyRecord.id;
		}
	}

	if (!apiKeyId) {
		throw new ORPCError("UNAUTHORIZED", { message: "Invalid API Key" });
	}

	// Find the worker associated with this apiKeyId
	const workerRecord = await db.query.worker.findFirst({
		where: (t, { eq }) => eq(t.apiKeyId, apiKeyId),
	});

	if (!workerRecord || !workerRecord.active) {
		throw new ORPCError("UNAUTHORIZED", {
			message: "Worker not found or inactive",
		});
	}

	// Update last heartbeat
	await db
		.update(worker)
		.set({ lastHeartbeat: new Date() })
		.where(eq(worker.id, workerRecord.id));

	return next({
		context: {
			...context,
			worker: workerRecord,
		},
	});
});

const workerProcedure = publicProcedure.use(requireWorkerAuth);

export const workerIngestRouter = {
	heartbeat: workerProcedure.handler(async ({ context }) => {
		const workerLocation = context.worker.location;
		console.log(`Worker Heartbeat: ${context.worker.name} (${workerLocation})`);

		// Return active monitors that match the worker's location
		const allActiveMonitors = await db.query.monitor.findMany({
			where: (t, { eq }) => eq(t.active, true),
		});

		console.log(`Found ${allActiveMonitors.length} active monitors total.`);

		const assignedMonitors = allActiveMonitors.filter((m) => {
			const locations = m.locations as string[];
			// Match if monitor has this worker's location OR if monitor has "global" (optional feature, but common)
			return locations.includes(workerLocation);
		});

		console.log(
			`Assigned ${assignedMonitors.length} monitors to worker ${workerLocation}`,
		);

		return {
			monitors: assignedMonitors.map((m) => {
				const config = m.config as {
					url: string;
					method?: string;
					headers?: Record<string, string>;
					body?: string;
					acceptedStatusCodes?: string;
					keyword?: string;
					jsonPath?: string;
				};
				return {
					id: m.id,
					type: m.type,
					url: config.url,
					interval: m.interval,
					timeout: m.timeout,
					method: config.method || "GET",
					headers: config.headers || {},
					body: config.body,
					acceptedStatusCodes: config.acceptedStatusCodes,
					keyword: config.keyword,
					jsonPath: config.jsonPath,
				};
			}),
		};
	}),
	processMaintenance: workerProcedure.handler(async () => {
		const now = new Date();

		// 1. Process scheduled -> in_progress
		const maintenanceToStart = await db.query.maintenance.findMany({
			where: (t, { eq, and, lte }) =>
				and(eq(t.status, "scheduled"), lte(t.startAt, now)),
		});

		for (const record of maintenanceToStart) {
			await db.transaction(async (tx) => {
				// Update status
				await tx
					.update(maintenance)
					.set({
						status: "in_progress",
						updatedAt: now,
					})
					.where(eq(maintenance.id, record.id));
			});
		}

		// 2. Process in_progress -> completed
		const maintenanceToFinish = await db.query.maintenance.findMany({
			where: (t, { eq, and, lte }) =>
				and(eq(t.status, "in_progress"), lte(t.endAt, now)),
		});

		for (const record of maintenanceToFinish) {
			await db.transaction(async (tx) => {
				// Update status
				await tx
					.update(maintenance)
					.set({
						status: "completed",
						updatedAt: now,
					})
					.where(eq(maintenance.id, record.id));
			});
		}

		return {
			started: maintenanceToStart.length,
			completed: maintenanceToFinish.length,
		};
	}),

	pushEvents: workerProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/worker/events",
				tags: ["worker"],
				summary: "Push monitor events",
				description: "Push monitor events from a worker",
			},
		})
		.input(
			z.object({
				events: z.array(monitorEventInputSchema),
			}),
		)
		.output(z.object({ success: z.boolean(), count: z.number() }))
		.handler(async ({ input }) => {
			const events = input.events;

			// Group events by monitor to handle ordering dependencies
			const eventsByMonitor = new Map<string, typeof events>();
			for (const event of events) {
				const list = eventsByMonitor.get(event.monitorId) || [];
				list.push(event);
				eventsByMonitor.set(event.monitorId, list);
			}

			const changesToInsert: (typeof monitorChange.$inferInsert)[] = [];
			const incidentsToInsert: (typeof incident.$inferInsert)[] = [];
			const incidentMonitorsToInsert: (typeof incidentMonitor.$inferInsert)[] =
				[];
			const activitiesToInsert: (typeof incidentActivity.$inferInsert)[] = [];

			for (const [monitorId, monitorEvents] of eventsByMonitor.entries()) {
				// Fetch monitor config
				const monitorConfig = await db.query.monitor.findFirst({
					where: eq(monitor.id, monitorId),
				});

				if (!monitorConfig) {
					console.warn(`Received events for unknown monitor: ${monitorId}`);
					continue;
				}

				// Check for active maintenance
				const activeMaintenance = await db
					.select({
						id: maintenance.id,
						title: maintenance.title,
					})
					.from(maintenance)
					.innerJoin(
						maintenanceMonitor,
						eq(maintenance.id, maintenanceMonitor.maintenanceId),
					)
					.where(
						and(
							eq(maintenanceMonitor.monitorId, monitorId),
							eq(maintenance.status, "in_progress"),
						),
					)
					.limit(1);

				if (activeMaintenance.length > 0) {
					for (const event of monitorEvents) {
						event.status = "maintenance";
					}
				}

				// Fetch active automatic incident
				const activeIncidentList = await db
					.select({
						id: incident.id,
						status: incident.status,
						resolvedAt: incident.resolvedAt,
						type: incident.type,
					})
					.from(incident)
					.innerJoin(
						incidentMonitor,
						eq(incident.id, incidentMonitor.incidentId),
					)
					.where(
						and(
							eq(incidentMonitor.monitorId, monitorId),
							eq(incident.type, "automatic"),
							isNull(incident.resolvedAt),
						),
					)
					.limit(1);

				let activeIncident:
					| {
							id: string;
							status: string;
							resolvedAt: Date | null;
							type: string;
					  }
					| undefined = activeIncidentList[0];

				// Sort by timestamp asc to process in order
				monitorEvents.sort(
					(a, b) =>
						new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
				);

				// Get latest status from DB
				const lastEvent = await db.query.monitorEvent.findFirst({
					where: (t, { eq }) => eq(t.monitorId, monitorId),
					orderBy: (t, { desc }) => desc(t.timestamp),
					columns: { status: true, timestamp: true },
				});

				// Get last change from DB to determine duration of current status
				const lastChangeRecord = await db.query.monitorChange.findFirst({
					where: (t, { eq }) => eq(t.monitorId, monitorId),
					orderBy: (t, { desc }) => desc(t.timestamp),
				});

				let currentStatus = lastEvent?.status;
				// If we have a last change, use its timestamp. Otherwise fallback to lastEvent or now.
				let lastChangeTime = lastChangeRecord?.timestamp
					? new Date(lastChangeRecord.timestamp)
					: lastEvent?.timestamp
						? new Date(lastEvent.timestamp)
						: new Date();

				for (const event of monitorEvents) {
					const eventTime = new Date(event.timestamp);
					const isChange =
						currentStatus !== undefined && currentStatus !== event.status;
					const isFirstEvent = currentStatus === undefined;

					if (isChange || isFirstEvent) {
						changesToInsert.push({
							id: crypto.randomUUID(),
							monitorId: event.monitorId,
							status: event.status,
							timestamp: eventTime,
							location: event.location || "unknown",
						});
						currentStatus = event.status;
						lastChangeTime = eventTime;
					}

					// Incident Logic
					if (currentStatus === "down") {
						const durationMs = eventTime.getTime() - lastChangeTime.getTime();
						const pendingMs = monitorConfig.incidentPendingDuration * 1000;

						if (durationMs >= pendingMs && !activeIncident) {
							// Create Incident
							const newIncidentId = crypto.randomUUID();
							// Store new activeIncident in memory so we don't duplicate
							activeIncident = {
								id: newIncidentId,
								status: "investigating",
								resolvedAt: null,
								type: "automatic",
							};

							incidentsToInsert.push({
								id: newIncidentId,
								organizationId: monitorConfig.organizationId,
								title: `Monitor ${monitorConfig.name} is down`,
								description: `Monitor ${monitorConfig.name} is down. \n\nError: ${event.error || "Unknown error"}`,
								status: "investigating",
								severity: "major",
								type: "automatic",
								createdAt: eventTime,
								updatedAt: eventTime,
							});

							incidentMonitorsToInsert.push({
								incidentId: newIncidentId,
								monitorId: monitorId,
							});

							activitiesToInsert.push({
								id: crypto.randomUUID(),
								incidentId: newIncidentId,
								message: `Incident opened automatically. Monitor reported down due to: ${event.error || "unknown error"}. (Region: ${event.location || "unknown"})`,
								type: "event",
								createdAt: eventTime,
								userId: null,
							});
						}
					} else if (currentStatus === "up" && activeIncident) {
						// Resolve Incident
						await db
							.update(incident)
							.set({
								status: "resolved",
								resolvedAt: eventTime,
								updatedAt: eventTime,
							})
							.where(eq(incident.id, activeIncident.id));

						eventBus.emit("incident.resolved", {
							incidentId: activeIncident.id,
							organizationId: monitorConfig.organizationId,
							title: `Monitor ${monitorConfig.name} recovered`,
							description: "Monitor is back up.",
							severity: "major", // Was major when created
						});

						activitiesToInsert.push({
							id: crypto.randomUUID(),
							incidentId: activeIncident.id,
							message: "Monitor recovered. Incident resolved automatically.",
							type: "event",
							createdAt: eventTime,
							userId: null,
						});

						activeIncident = undefined; // No longer active in this loop
					}
				}
			}

			if (changesToInsert.length > 0) {
				await db.insert(monitorChange).values(changesToInsert);
			}

			if (incidentsToInsert.length > 0) {
				await db.insert(incident).values(incidentsToInsert);
				// Emit events
				for (const inc of incidentsToInsert) {
					eventBus.emit("incident.created", {
						incidentId: inc.id,
						organizationId: inc.organizationId,
						title: inc.title,
						description: inc.description,
						severity: inc.severity as any,
					});
				}
			}

			if (incidentMonitorsToInsert.length > 0) {
				await db.insert(incidentMonitor).values(incidentMonitorsToInsert);
			}

			if (activitiesToInsert.length > 0) {
				await db.insert(incidentActivity).values(activitiesToInsert);
			}

			if (events.length > 0) {
				await db.insert(monitorEvent).values(
					events.map((e) => ({
						...e,
						id: crypto.randomUUID(),
						timestamp: new Date(e.timestamp),
					})),
				);
			}

			return { success: true, count: events.length };
		}),
};
