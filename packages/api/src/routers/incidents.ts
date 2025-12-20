import { ORPCError } from "@orpc/server";
import { db } from "@uptimekit/db";
import {
	incident,
	incidentActivity,
	incidentMonitor,
} from "@uptimekit/db/schema/incidents";
import { and, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, writeProcedure } from "../index";
import { eventBus } from "../lib/events";

export const incidentsRouter = {
	list: protectedProcedure
		.input(
			z.object({
				limit: z.number().default(50),
				offset: z.number().default(0),
				status: z.enum(["open", "resolved", "all"]).default("all"),
				q: z.string().optional(),
				severity: z.enum(["minor", "major", "critical"]).optional(),
				type: z.enum(["manual", "automatic"]).optional(),
			}),
		)
		.handler(async ({ input, context }) => {
			const filters = [
				eq(
					incident.organizationId,
					context.session.session.activeOrganizationId!,
				),
			];
			if (input.status === "open") {
				filters.push(isNull(incident.resolvedAt));
			} else if (input.status === "resolved") {
				filters.push(sql`${incident.resolvedAt} IS NOT NULL`);
			}

			if (input.q) {
				filters.push(ilike(incident.title, `%${input.q}%`));
			}

			if (input.severity) {
				filters.push(eq(incident.severity, input.severity));
			}

			if (input.type) {
				filters.push(eq(incident.type, input.type));
			}

			const [total, items] = await Promise.all([
				db.$count(incident, and(...filters)),
				db.query.incident.findMany({
					where: and(...filters),

					limit: input.limit,
					offset: input.offset,
					orderBy: [desc(incident.createdAt)],
					with: {
						monitors: {
							with: {
								monitor: true,
							},
						},
						activities: {
							limit: 1,
							orderBy: [desc(incidentActivity.createdAt)],
						},
					},
				}),
			]);

			return {
				items,
				total,
			};
		}),

	get: protectedProcedure
		.input(z.object({ id: z.string() }))
		.handler(async ({ input }) => {
			const item = await db.query.incident.findFirst({
				where: eq(incident.id, input.id),
				with: {
					monitors: {
						with: {
							monitor: true,
						},
					},
					activities: {
						orderBy: [desc(incidentActivity.createdAt)],
						with: {
							user: true,
						},
					},
					organization: true,
					acknowledgedByUser: true,
				},
			});

			if (!item) {
				throw new ORPCError("NOT_FOUND", { message: "Incident not found" });
			}

			return item;
		}),

	create: writeProcedure
		.input(
			z.object({
				title: z.string().min(1),
				description: z.string().optional(),
				severity: z.enum(["minor", "major", "critical"]),
				monitorIds: z.array(z.string()).default([]),
			}),
		)
		.handler(async ({ input, context }) => {
			const id = crypto.randomUUID();
			const now = new Date();

			await db.transaction(async (tx) => {
				await tx.insert(incident).values({
					id,
					organizationId: context.session.session.activeOrganizationId!,
					title: input.title,
					description: input.description,
					severity: input.severity,
					status: "investigating",
					type: "manual",
					createdAt: now,
					updatedAt: now,
				});

				if (input.monitorIds.length > 0) {
					// Verify monitors belong to org?
					// Assume yes for now, but good practice to verify in real app
					await tx.insert(incidentMonitor).values(
						input.monitorIds.map((mid) => ({
							incidentId: id,
							monitorId: mid,
						})),
					);
				}

				await tx.insert(incidentActivity).values({
					id: crypto.randomUUID(),
					incidentId: id,
					message: `Incident created by ${context.session.user.name}`,
					type: "comment",
					createdAt: now,
					userId: context.session.user.id,
				});
			});

			eventBus.emit("incident.created", {
				incidentId: id,
				organizationId: context.session.session.activeOrganizationId!,
				title: input.title,
				description: input.description,
				severity: input.severity,
			});

			return { id };
		}),

	acknowledge: writeProcedure
		.input(z.object({ id: z.string() }))
		.handler(async ({ input, context }) => {
			const now = new Date();

			const existing = await db.query.incident.findFirst({
				where: eq(incident.id, input.id),
			});
			if (!existing)
				throw new ORPCError("NOT_FOUND", { message: "Incident not found" });

			if (existing.acknowledgedAt) {
				return { success: true, message: "Already acknowledged" };
			}

			await db.transaction(async (tx) => {
				await tx
					.update(incident)
					.set({
						status: "identified",
						acknowledgedAt: now,
						acknowledgedBy: context.session.user.id,
						updatedAt: now,
					})
					.where(eq(incident.id, input.id));

				await tx.insert(incidentActivity).values({
					id: crypto.randomUUID(),
					incidentId: input.id,
					message: `Incident acknowledged by ${context.session.user.name}`,
					type: "comment",
					createdAt: now,
					userId: context.session.user.id,
				});
			});

			eventBus.emit("incident.acknowledged", {
				incidentId: input.id,
				organizationId: existing.organizationId,
				title: existing.title,
				description: existing.description,
				severity: existing.severity as any,
			});

			return { success: true };
		}),

	resolve: writeProcedure
		.input(z.object({ id: z.string() }))
		.handler(async ({ input, context }) => {
			const now = new Date();
			const existing = await db.query.incident.findFirst({
				where: eq(incident.id, input.id),
			});
			if (!existing)
				throw new ORPCError("NOT_FOUND", { message: "Incident not found" });

			if (existing.resolvedAt) {
				return { success: true, message: "Already resolved" };
			}

			await db.transaction(async (tx) => {
				await tx
					.update(incident)
					.set({
						status: "resolved",
						resolvedAt: now,
						updatedAt: now,
					})
					.where(eq(incident.id, input.id));

				await tx.insert(incidentActivity).values({
					id: crypto.randomUUID(),
					incidentId: input.id,
					message: `Incident resolved by ${context.session.user.name}`,
					type: "comment",
					createdAt: now,
					userId: context.session.user.id,
				});
			});

			eventBus.emit("incident.resolved", {
				incidentId: input.id,
				organizationId: existing.organizationId,
				title: existing.title,
				description: existing.description,
				severity: existing.severity as any,
			});

			return { success: true };
		}),

	addComment: writeProcedure
		.input(z.object({ incidentId: z.string(), message: z.string().min(1) }))
		.handler(async ({ input, context }) => {
			const now = new Date();
			const existing = await db.query.incident.findFirst({
				where: eq(incident.id, input.incidentId),
			});
			if (!existing)
				throw new ORPCError("NOT_FOUND", { message: "Incident not found" });

			await db.insert(incidentActivity).values({
				id: crypto.randomUUID(),
				incidentId: input.incidentId,
				message: input.message,
				type: "comment",
				createdAt: now,
				userId: context.session.user.id,
			});

			eventBus.emit("incident.comment_added", {
				incidentId: input.incidentId,
				organizationId: existing.organizationId,
				title: existing.title,
				message: input.message,
				severity: existing.severity as any,
			});

			return { success: true };
		}),
};
