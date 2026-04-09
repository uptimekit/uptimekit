import { ORPCError } from "@orpc/server";
import { db } from "@uptimekit/db";
import { worker, workerApiKey } from "@uptimekit/db/schema/workers";
import {
	and,
	desc,
	eq,
	type InferSelectModel,
	ilike,
	isNotNull,
	isNull,
	or,
} from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../index";
import { createLogger } from "../lib/logger";
import { hashApiKey, invalidateApiKeyCache } from "../pkg/worker/auth";

const logger = createLogger("API");

type Worker = InferSelectModel<typeof worker>;

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
		.meta({
			openapi: {
				method: "GET",
				path: "/workers",
				tags: ["Worker Management"],
				summary: "List workers",
				description: "List all registered monitoring workers.",
			},
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
			if (context.session.user.role !== "admin") {
				throw new ORPCError("UNAUTHORIZED");
			}

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
				if (input.status === "online") {
					filters.push(
						and(eq(worker.active, true), isNotNull(worker.lastHeartbeat)),
					);
				} else if (input.status === "offline") {
					filters.push(
						and(eq(worker.active, false), isNotNull(worker.lastHeartbeat)),
					);
				} else if (input.status === "unknown") {
					filters.push(isNull(worker.lastHeartbeat));
				}
			}

			const [items, total] = await Promise.all([
				db
					.select()
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
		.meta({
			openapi: {
				method: "POST",
				path: "/workers",
				tags: ["Worker Management"],
				summary: "Create worker",
				description: "Register a new monitoring worker.",
			},
		})
		.input(
			z.object({
				name: z.string().min(1),
				location: z.string().min(1),
			}),
		)
		.handler(
			async ({ input, context }): Promise<{ worker: Worker; key: string }> => {
				if (context.session.user.role !== "admin") {
					throw new ORPCError("UNAUTHORIZED");
				}

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

	rotateKey: protectedProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/workers/{id}/rotate-key",
				tags: ["Worker Management"],
				summary: "Rotate worker key",
				description:
					"Generate a new API key for a worker and invalidate the old one.",
			},
		})
		.input(z.object({ id: z.string() }))
		.handler(async ({ input, context }): Promise<{ key: string }> => {
			if (context.session.user.role !== "admin") {
				throw new ORPCError("UNAUTHORIZED");
			}

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
		.meta({
			openapi: {
				method: "DELETE",
				path: "/workers/{id}",
				tags: ["Worker Management"],
				summary: "Delete worker",
				description: "Delete a worker and its associated API keys.",
			},
		})
		.input(z.object({ id: z.string() }))
		.handler(async ({ input, context }) => {
			if (context.session.user.role !== "admin") {
				throw new ORPCError("UNAUTHORIZED");
			}

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

			// Delete API keys first (foreign key constraint)
			await db.delete(workerApiKey).where(eq(workerApiKey.workerId, input.id));

			// Delete the worker
			await db.delete(worker).where(eq(worker.id, input.id));

			// Invalidate cached API keys
			for (const key of apiKeys) {
				invalidateApiKeyCache(key.keyHash);
			}

			logger.info(`Deleted worker ${workerRecord.name}`);

			return { success: true };
		}),

	listLocations: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/workers/locations",
				tags: ["workers"],
				summary: "List worker locations",
				description: "List unique locations of active workers.",
			},
		})
		.handler(async () => {
			const locations = await db
				.selectDistinct({ location: worker.location })
				.from(worker)
				.where(eq(worker.active, true));

			return locations.map((l) => l.location);
		}),

	listActive: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/workers/active",
				tags: ["workers"],
				summary: "List active workers",
				description: "List active workers available for monitor assignment.",
			},
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
