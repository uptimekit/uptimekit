import { db } from "@uptimekit/db";
import {
	maintenance,
	maintenanceStatusPage,
	maintenanceMonitor,
	maintenanceUpdate,
} from "@uptimekit/db/schema/maintenance";
import { statusPage } from "@uptimekit/db/schema/status-pages";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../index";
import { ORPCError } from "@orpc/server";

export const maintenanceRouter = {
	list: protectedProcedure
		.input(
			z.object({
				statusPageId: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const activeOrganizationId = context.session.session.activeOrganizationId;

			if (!activeOrganizationId) {
				throw new ORPCError("UNAUTHORIZED", {
					message: "No active organization",
				});
			}

			const page = await db.query.statusPage.findFirst({
				where: and(
					eq(statusPage.id, input.statusPageId),
					eq(statusPage.organizationId, activeOrganizationId),
				),
			});

			if (!page) {
				throw new ORPCError("NOT_FOUND", { message: "Status page not found" });
			}

			const records = await db.query.maintenanceStatusPage.findMany({
				where: eq(maintenanceStatusPage.statusPageId, input.statusPageId),
				with: {
					maintenance: true,
				},
			});

			return records
				.map((r) => r.maintenance)
				.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
		}),

	create: protectedProcedure
		.input(
			z.object({
				statusPageId: z.string(),
				title: z.string().min(1),
				description: z.string().optional(),
				startAt: z.string().datetime(),
				endAt: z.string().datetime(),
				status: z.enum(["scheduled", "in_progress", "completed"]),
				monitorIds: z.array(z.string()).optional(),
			}),
		)
		.handler(async ({ input, context }) => {
			const activeOrganizationId = context.session.session.activeOrganizationId;

			if (!activeOrganizationId) {
				throw new ORPCError("UNAUTHORIZED", {
					message: "No active organization",
				});
			}

			const page = await db.query.statusPage.findFirst({
				where: and(
					eq(statusPage.id, input.statusPageId),
					eq(statusPage.organizationId, activeOrganizationId),
				),
			});

			if (!page) {
				throw new ORPCError("NOT_FOUND", { message: "Status page not found" });
			}

			const maintenanceId = crypto.randomUUID();
			const now = new Date();

			await db.transaction(async (tx) => {
				await tx.insert(maintenance).values({
					id: maintenanceId,
					organizationId: activeOrganizationId,
					title: input.title,
					description: input.description,
					startAt: new Date(input.startAt),
					endAt: new Date(input.endAt),
					status: input.status,
					createdAt: now,
					updatedAt: now,
				});

				await tx.insert(maintenanceStatusPage).values({
					maintenanceId: maintenanceId,
					statusPageId: input.statusPageId,
				});

				if (input.monitorIds && input.monitorIds.length > 0) {
					await tx.insert(maintenanceMonitor).values(
						input.monitorIds.map((monitorId) => ({
							maintenanceId: maintenanceId,
							monitorId: monitorId,
						})),
					);
				}

				// Create initial update if description is provided
				if (input.description) {
					await tx.insert(maintenanceUpdate).values({
						id: crypto.randomUUID(),
						maintenanceId: maintenanceId,
						message: input.description,
						status: input.status,
						createdAt: now,
						updatedAt: now,
					});
				}
			});

			return { id: maintenanceId };
		}),
	get: protectedProcedure
		.input(
			z.object({
				maintenanceId: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const activeOrganizationId = context.session.session.activeOrganizationId;

			if (!activeOrganizationId) {
				throw new ORPCError("UNAUTHORIZED", {
					message: "No active organization",
				});
			}

			const record = await db.query.maintenance.findFirst({
				where: and(
					eq(maintenance.id, input.maintenanceId),
					eq(maintenance.organizationId, activeOrganizationId),
				),
				with: {
					updates: {
						orderBy: (updates, { desc }) => [desc(updates.createdAt)],
					},
					monitors: {
						with: {
							monitor: true,
						},
					},
				},
			});

			if (!record) {
				throw new ORPCError("NOT_FOUND", { message: "Maintenance not found" });
			}

			return record;
		}),

	update: protectedProcedure
		.input(
			z.object({
				maintenanceId: z.string(),
				startAt: z.string().datetime(),
				endAt: z.string().datetime(),
			}),
		)
		.handler(async ({ input, context }) => {
			const activeOrganizationId = context.session.session.activeOrganizationId;

			if (!activeOrganizationId) {
				throw new ORPCError("UNAUTHORIZED", {
					message: "No active organization",
				});
			}

			const record = await db.query.maintenance.findFirst({
				where: and(
					eq(maintenance.id, input.maintenanceId),
					eq(maintenance.organizationId, activeOrganizationId),
				),
			});

			if (!record) {
				throw new ORPCError("NOT_FOUND", { message: "Maintenance not found" });
			}

			await db
				.update(maintenance)
				.set({
					startAt: new Date(input.startAt),
					endAt: new Date(input.endAt),
					updatedAt: new Date(),
				})
				.where(eq(maintenance.id, input.maintenanceId));

			return { success: true };
		}),

	createUpdate: protectedProcedure
		.input(
			z.object({
				maintenanceId: z.string(),
				message: z.string().min(1),
				status: z.enum(["scheduled", "in_progress", "completed"]),
			}),
		)
		.handler(async ({ input, context }) => {
			const activeOrganizationId = context.session.session.activeOrganizationId;

			if (!activeOrganizationId) {
				throw new ORPCError("UNAUTHORIZED", {
					message: "No active organization",
				});
			}

			const record = await db.query.maintenance.findFirst({
				where: and(
					eq(maintenance.id, input.maintenanceId),
					eq(maintenance.organizationId, activeOrganizationId),
				),
			});

			if (!record) {
				throw new ORPCError("NOT_FOUND", { message: "Maintenance not found" });
			}

			const updateId = crypto.randomUUID();
			const now = new Date();

			await db.transaction(async (tx) => {
				await tx.insert(maintenanceUpdate).values({
					id: updateId,
					maintenanceId: input.maintenanceId,
					message: input.message,
					status: input.status,
					createdAt: now,
					updatedAt: now,
				});

				// Determine if we need to update startAt or endAt
				const updates: Partial<typeof maintenance.$inferSelect> = {
					status: input.status,
					updatedAt: now,
				};

				if (record.status === "scheduled" && input.status === "in_progress") {
					updates.startAt = now;
				}

				if (input.status === "completed") {
					updates.endAt = now;
				}

				// Update maintenance status and updatedAt
				await tx
					.update(maintenance)
					.set(updates)
					.where(eq(maintenance.id, input.maintenanceId));
			});

			return { id: updateId };
		}),

	updateUpdate: protectedProcedure
		.input(
			z.object({
				updateId: z.string(),
				message: z.string().min(1),
				status: z.enum(["scheduled", "in_progress", "completed"]).optional(),
			}),
		)
		.handler(async ({ input, context }) => {
			const activeOrganizationId = context.session.session.activeOrganizationId;

			if (!activeOrganizationId) {
				throw new ORPCError("UNAUTHORIZED", {
					message: "No active organization",
				});
			}

			const update = await db.query.maintenanceUpdate.findFirst({
				where: eq(maintenanceUpdate.id, input.updateId),
				with: {
					maintenance: true,
				},
			});

			if (
				!update ||
				update.maintenance.organizationId !== activeOrganizationId
			) {
				throw new ORPCError("NOT_FOUND", {
					message: "Update not found or access denied",
				});
			}

			await db
				.update(maintenanceUpdate)
				.set({
					message: input.message,
					...(input.status ? { status: input.status } : {}),
					updatedAt: new Date(),
				})
				.where(eq(maintenanceUpdate.id, input.updateId));

			return { success: true };
		}),

	deleteUpdate: protectedProcedure
		.input(
			z.object({
				updateId: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const activeOrganizationId = context.session.session.activeOrganizationId;

			if (!activeOrganizationId) {
				throw new ORPCError("UNAUTHORIZED", {
					message: "No active organization",
				});
			}

			const update = await db.query.maintenanceUpdate.findFirst({
				where: eq(maintenanceUpdate.id, input.updateId),
				with: {
					maintenance: true,
				},
			});

			if (
				!update ||
				update.maintenance.organizationId !== activeOrganizationId
			) {
				throw new ORPCError("NOT_FOUND", {
					message: "Update not found or access denied",
				});
			}

			await db
				.delete(maintenanceUpdate)
				.where(eq(maintenanceUpdate.id, input.updateId));

			return { success: true };
		}),
};
