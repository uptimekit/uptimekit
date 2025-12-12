import { auth } from "@uptimekit/auth";
import { monitorChange, monitorEvent } from "@uptimekit/db/schema/monitors";
import { worker } from "@uptimekit/db/schema/workers";
import { db } from "@uptimekit/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { o, publicProcedure, protectedProcedure } from "../index";
import { ORPCError } from "@orpc/server";

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
				};
			}),
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
		.handler(async ({ input, context }) => {
			const events = input.events;

			// Group events by monitor to handle ordering dependencies
			const eventsByMonitor = new Map<string, typeof events>();
			for (const event of events) {
				const list = eventsByMonitor.get(event.monitorId) || [];
				list.push(event);
				eventsByMonitor.set(event.monitorId, list);
			}

			const changesToInsert: (typeof monitorChange.$inferInsert)[] = [];

			for (const [monitorId, monitorEvents] of eventsByMonitor.entries()) {
				// Sort by timestamp asc to process in order
				monitorEvents.sort(
					(a, b) =>
						new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
				);

				// Get latest status from DB
				const lastEvent = await db.query.monitorEvent.findFirst({
					where: (t, { eq }) => eq(t.monitorId, monitorId),
					orderBy: (t, { desc }) => desc(t.timestamp),
					columns: { status: true },
				});

				let currentStatus = lastEvent?.status;

				for (const event of monitorEvents) {
					// Initialize currentStatus if it was undefined (first event ever)
					// If first event ever, is it a change?
					// Usually yes, from "unknown" to "something".
					// But if strictly "change", maybe not?
					// Let's record it if currentStatus is defined (change) OR if it is the first event ever (initial state).

					const isChange =
						currentStatus !== undefined && currentStatus !== event.status;
					const isFirstEvent = currentStatus === undefined;

					if (isChange || isFirstEvent) {
						changesToInsert.push({
							id: crypto.randomUUID(),
							monitorId: event.monitorId,
							status: event.status,
							timestamp: new Date(event.timestamp),
							location: event.location || "unknown",
						});
						currentStatus = event.status;
					}
				}
			}

			if (changesToInsert.length > 0) {
				await db.insert(monitorChange).values(changesToInsert);
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
