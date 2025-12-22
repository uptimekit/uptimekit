import { ORPCError } from "@orpc/server";
import { auth } from "@uptimekit/auth";
import { db } from "@uptimekit/db";
import { worker } from "@uptimekit/db/schema/workers";
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

type Worker = InferSelectModel<typeof worker>;

export const workersRouter = {
	list: protectedProcedure
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

				const apiKey = await auth.api.createApiKey({
					headers: context.headers,
					body: {
						name: `Worker: ${input.name}`,
						expiresIn: undefined,
					},
				});

				if (!apiKey) {
					throw new ORPCError("INTERNAL_SERVER_ERROR");
				}

				const [newWorker] = await db
					.insert(worker)
					.values({
						id: crypto.randomUUID(),
						name: input.name,
						location: input.location,
						apiKeyId: apiKey.id,
						active: true,
					})
					.returning();

				if (!newWorker) {
					throw new ORPCError("INTERNAL_SERVER_ERROR");
				}

				return {
					worker: newWorker,
					key: apiKey.key,
				};
			},
		),

	rotateKey: protectedProcedure
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

			// 1. Create new key FIRST
			const newKey = await auth.api.createApiKey({
				headers: context.headers,
				body: {
					name: `Worker: ${workerRecord.name}`,
					expiresIn: undefined,
				},
			});

			if (!newKey) {
				throw new ORPCError("INTERNAL_SERVER_ERROR");
			}

			// 2. Update worker to reference new key
			// This safely detaches the old key
			await db
				.update(worker)
				.set({ apiKeyId: newKey.id })
				.where(eq(worker.id, input.id));

			// 3. Delete old key (now safe)
			if (workerRecord.apiKeyId) {
				try {
					await auth.api.deleteApiKey({
						headers: context.headers,
						body: { keyId: workerRecord.apiKeyId },
					});
				} catch (error) {
					// Log error but don't fail the request, as rotation technically succeeded
					console.error("Failed to delete old API key:", error);
				}
			}

			return { key: newKey.key };
		}),
	listLocations: protectedProcedure.handler(async () => {
		const locations = await db
			.selectDistinct({ location: worker.location })
			.from(worker)
			.where(eq(worker.active, true));

		return locations.map((l) => l.location);
	}),
};
