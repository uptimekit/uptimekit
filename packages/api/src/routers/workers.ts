import { auth } from "@uptimekit/auth";
import { db } from "@uptimekit/db";
import { worker } from "@uptimekit/db/schema/workers";
import { eq, type InferSelectModel } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../index";
import { ORPCError } from "@orpc/server";

type Worker = InferSelectModel<typeof worker>;

export const workersRouter = {
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
};
