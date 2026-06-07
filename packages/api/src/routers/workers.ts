import { ORPCError } from "@orpc/server";
import { db } from "@uptimekit/db";
import { monitor } from "@uptimekit/db/schema/monitors";
import { worker, workerApiKey } from "@uptimekit/db/schema/workers";
import {
	and,
	desc,
	eq,
	gte,
	type InferSelectModel,
	ilike,
	inArray,
	isNotNull,
	isNull,
	lt,
	or,
	sql,
} from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../index";
import { createLogger } from "../lib/logger";
import { getWorkerHeartbeatThreshold } from "../lib/worker-status";
import { hashApiKey, invalidateApiKeyCache } from "../pkg/worker/auth";

const logger = createLogger("API");

type Worker = InferSelectModel<typeof worker>;
const WORKER_DELETED_PAUSE_REASON = "worker_deleted";

function requireInstanceAdmin(context: {
	session: { user: { role?: string | null } };
}) {
	if (context.session.user.role !== "admin") {
		throw new ORPCError("FORBIDDEN", {
			message: "Instance admin access required.",
		});
	}
}

// Generate a secure random API key with prefix
function generateApiKey(): string {
	const prefix = "uk_"; // UptimeKit prefix
	const randomBytes = crypto.getRandomValues(new Uint8Array(32));
	const key = Array.from(randomBytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return `${prefix}${key}`;
}

export const workersRouter = {
	list: protectedProcedure
		.route({
			method: "GET",
			path: "/workers",
			tags: ["Worker Management"],
			summary: "List workers",
			description: "List all registered monitoring workers.",
		})
		.input(
			z
				.object({
					q: z.string().optional(),
					status: z
						.enum(["online", "offline", "unknown", "all"])
						.default("all"),
					limit: z.number().default(50),
					offset: z.number().default(0),
				})
				.optional(),
		)
		.handler(async ({ input, context }) => {
			requireInstanceAdmin(context);

			const filters = [];

			if (input?.q) {
				filters.push(
					or(
						ilike(worker.name, `%${input.q}%`),
						ilike(worker.id, `%${input.q}%`),
					),
				);
			}

			if (input?.status) {
				const heartbeatThreshold = getWorkerHeartbeatThreshold();

				if (input.status === "online") {
					filters.push(
						and(
							eq(worker.active, true),
							isNotNull(worker.lastHeartbeat),
							gte(worker.lastHeartbeat, heartbeatThreshold),
						),
					);
				} else if (input.status === "offline") {
					filters.push(
						and(
							isNotNull(worker.lastHeartbeat),
							or(
								eq(worker.active, false),
								lt(worker.lastHeartbeat, heartbeatThreshold),
							),
						),
					);
				} else if (input.status === "unknown") {
					filters.push(isNull(worker.lastHeartbeat));
				}
			}

			const [items, total] = await Promise.all([
				db
					.select({
						id: worker.id,
						name: worker.name,
						location: worker.location,
						active: worker.active,
						lastHeartbeat: worker.lastHeartbeat,
						version: worker.version,
						createdAt: worker.createdAt,
						updatedAt: worker.updatedAt,
						monitorCount: sql<number>`(
								SELECT COUNT(DISTINCT "monitor"."id")
								FROM ${monitor}
								CROSS JOIN LATERAL json_array_elements_text("monitor"."locations") AS location(location)
								WHERE location.location = ${worker.location}
							)`
							.mapWith(Number)
							.as("monitor_count"),
					})
					.from(worker)
					.where(and(...filters))
					.orderBy(desc(worker.createdAt))
					.limit(input?.limit || 50)
					.offset(input?.offset || 0),
				db.$count(worker, and(...filters)),
			]);

			return { items, total };
		}),
	create: protectedProcedure
		.route({
			method: "POST",
			path: "/workers",
			tags: ["Worker Management"],
			summary: "Create worker",
			description: "Register a new monitoring worker.",
		})
		.input(
			z.object({
				name: z.string().min(1),
				location: z.string().min(1),
			}),
		)
		.handler(
			async ({ input, context }): Promise<{ worker: Worker; key: string }> => {
				requireInstanceAdmin(context);

				// Generate the raw API key
				const rawKey = generateApiKey();
				const keyHash = await hashApiKey(rawKey);
				const keyHint = `${rawKey.substring(0, 11)}...`; // e.g., "uk_abc1234..."

				// Create the worker first
				const [newWorker] = await db
					.insert(worker)
					.values({
						id: crypto.randomUUID(),
						name: input.name,
						location: input.location,
						active: true,
					})
					.returning();

				if (!newWorker) {
					throw new ORPCError("INTERNAL_SERVER_ERROR");
				}

				// Create the API key for this worker
				await db.insert(workerApiKey).values({
					id: crypto.randomUUID(),
					keyHash,
					keyHint,
					workerId: newWorker.id,
				});

				return {
					worker: newWorker,
					key: rawKey, // Return raw key only once
				};
			},
		),

	update: protectedProcedure
		.route({
			method: "PATCH",
			path: "/workers/{id}",
			tags: ["Worker Management"],
			summary: "Update worker",
			description: "Update a monitoring worker's name and location.",
		})
		.input(
			z.object({
				id: z.string(),
				name: z.string().trim().min(1),
				location: z.string().trim().min(1),
			}),
		)
		.handler(async ({ input, context }): Promise<Worker> => {
			requireInstanceAdmin(context);

			const updatedWorker = await db.transaction(async (tx) => {
				const [existingWorker] = await tx
					.select()
					.from(worker)
					.where(eq(worker.id, input.id))
					.limit(1);

				if (!existingWorker) {
					throw new ORPCError("NOT_FOUND");
				}

				const [nextWorker] = await tx
					.update(worker)
					.set({
						name: input.name,
						location: input.location,
					})
					.where(eq(worker.id, input.id))
					.returning();

				if (!nextWorker) {
					throw new ORPCError("INTERNAL_SERVER_ERROR");
				}

				if (existingWorker.location !== input.location) {
					const affectedMonitors = await tx
						.select({
							id: monitor.id,
							workerIds: monitor.workerIds,
						})
						.from(monitor)
						.where(
							sql`${monitor.workerIds}::jsonb @> ${JSON.stringify([input.id])}::jsonb`,
						);

					const assignedWorkerIds = [
						...new Set(
							affectedMonitors.flatMap(
								(monitorRecord) =>
									(monitorRecord.workerIds as string[] | null) ?? [],
							),
						),
					];

					const assignedWorkers =
						assignedWorkerIds.length > 0
							? await tx
									.select({
										id: worker.id,
										location: worker.location,
									})
									.from(worker)
									.where(inArray(worker.id, assignedWorkerIds))
							: [];

					const locationByWorkerId = new Map(
						assignedWorkers.map((workerRecord) => [
							workerRecord.id,
							workerRecord.location,
						]),
					);

					for (const monitorRecord of affectedMonitors) {
						const nextLocations = [
							...new Set(
								((monitorRecord.workerIds as string[] | null) ?? [])
									.map((workerId) => locationByWorkerId.get(workerId))
									.filter(
										(location): location is string => location !== undefined,
									),
							),
						];

						await tx
							.update(monitor)
							.set({
								locations: nextLocations,
							})
							.where(eq(monitor.id, monitorRecord.id));
					}
				}

				return nextWorker;
			});

			logger.info(`Updated worker ${updatedWorker.name}`);

			return updatedWorker;
		}),

	rotateKey: protectedProcedure
		.route({
			method: "POST",
			path: "/workers/{id}/rotate-key",
			tags: ["Worker Management"],
			summary: "Rotate worker key",
			description:
				"Generate a new API key for a worker and invalidate the old one.",
		})
		.input(z.object({ id: z.string() }))
		.handler(async ({ input, context }): Promise<{ key: string }> => {
			requireInstanceAdmin(context);

			const [workerRecord] = await db
				.select()
				.from(worker)
				.where(eq(worker.id, input.id))
				.limit(1);

			if (!workerRecord) {
				throw new ORPCError("NOT_FOUND");
			}

			// Get old key hashes for cache invalidation
			const oldKeys = await db
				.select({ keyHash: workerApiKey.keyHash })
				.from(workerApiKey)
				.where(eq(workerApiKey.workerId, input.id));

			// Generate new key
			const rawKey = generateApiKey();
			const keyHash = await hashApiKey(rawKey);
			const keyHint = `${rawKey.substring(0, 11)}...`;

			// Delete old keys and create new one in a transaction-like manner
			await db.delete(workerApiKey).where(eq(workerApiKey.workerId, input.id));

			await db.insert(workerApiKey).values({
				id: crypto.randomUUID(),
				keyHash,
				keyHint,
				workerId: input.id,
			});

			// Invalidate old keys from cache
			for (const oldKey of oldKeys) {
				invalidateApiKeyCache(oldKey.keyHash);
			}

			logger.info(`Rotated API key for worker ${workerRecord.name}`);

			return { key: rawKey };
		}),

	delete: protectedProcedure
		.route({
			method: "DELETE",
			path: "/workers/{id}",
			tags: ["Worker Management"],
			summary: "Delete worker",
			description: "Delete a worker and its associated API keys.",
		})
		.input(z.object({ id: z.string() }))
		.handler(async ({ input, context }) => {
			requireInstanceAdmin(context);

			const [workerRecord] = await db
				.select()
				.from(worker)
				.where(eq(worker.id, input.id))
				.limit(1);

			if (!workerRecord) {
				throw new ORPCError("NOT_FOUND");
			}

			// Get API key hashes for cache invalidation
			const apiKeys = await db
				.select({ keyHash: workerApiKey.keyHash })
				.from(workerApiKey)
				.where(eq(workerApiKey.workerId, input.id));

			await db.transaction(async (tx) => {
				const affectedMonitors = await tx
					.select()
					.from(monitor)
					.where(
						sql`${monitor.workerIds}::jsonb @> ${JSON.stringify([input.id])}::jsonb`,
					);

				const uniqueNextWorkerIds = new Set<string>();
				for (const monitorRecord of affectedMonitors) {
					const nextWorkerIds = (
						(monitorRecord.workerIds as string[] | null) ?? []
					).filter((workerId) => workerId !== input.id);
					for (const workerId of nextWorkerIds) {
						uniqueNextWorkerIds.add(workerId);
					}
				}

				const remainingWorkers =
					uniqueNextWorkerIds.size > 0
						? await tx
								.select({
									id: worker.id,
									location: worker.location,
								})
								.from(worker)
								.where(inArray(worker.id, [...uniqueNextWorkerIds]))
						: [];

				const workerLocationMap = new Map(
					remainingWorkers.map((w) => [w.id, w.location]),
				);

				for (const monitorRecord of affectedMonitors) {
					const nextWorkerIds = (
						(monitorRecord.workerIds as string[] | null) ?? []
					).filter((workerId) => workerId !== input.id);

					const nextLocations = [
						...new Set(
							nextWorkerIds
								.map((workerId) => workerLocationMap.get(workerId))
								.filter((loc): loc is string => loc !== undefined),
						),
					];
					const hasAssignedWorkers = nextWorkerIds.length > 0;

					await tx
						.update(monitor)
						.set({
							workerIds: nextWorkerIds,
							locations: nextLocations,
							active: hasAssignedWorkers ? monitorRecord.active : false,
							pauseReason: hasAssignedWorkers
								? monitorRecord.pauseReason
								: WORKER_DELETED_PAUSE_REASON,
						})
						.where(eq(monitor.id, monitorRecord.id));
				}

				// Delete API keys first (foreign key constraint)
				await tx
					.delete(workerApiKey)
					.where(eq(workerApiKey.workerId, input.id));

				// Delete the worker
				await tx.delete(worker).where(eq(worker.id, input.id));
			});

			// Invalidate cached API keys
			for (const key of apiKeys) {
				invalidateApiKeyCache(key.keyHash);
			}

			logger.info(`Deleted worker ${workerRecord.name}`);

			return { success: true };
		}),

	listLocations: protectedProcedure
		.route({
			method: "GET",
			path: "/workers/locations",
			tags: ["workers"],
			summary: "List worker locations",
			description: "List unique locations of active workers.",
		})
		.handler(async () => {
			const locations = await db
				.selectDistinct({ location: worker.location })
				.from(worker)
				.where(eq(worker.active, true));

			return locations.map((l) => l.location);
		}),

	listActive: protectedProcedure
		.route({
			method: "GET",
			path: "/workers/active",
			tags: ["workers"],
			summary: "List active workers",
			description: "List active workers available for monitor assignment.",
		})
		.handler(async () => {
			return db
				.select({
					id: worker.id,
					name: worker.name,
					location: worker.location,
				})
				.from(worker)
				.where(eq(worker.active, true))
				.orderBy(desc(worker.createdAt));
		}),
};
