import { ORPCError } from "@orpc/server";
import { db } from "@uptimekit/db";
import {
	incident,
	incidentActivity,
	incidentMonitor,
	incidentStatusPage,
} from "@uptimekit/db/schema/incidents";
import { monitor } from "@uptimekit/db/schema/monitors";
import { statusPage } from "@uptimekit/db/schema/status-pages";
import { and, desc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, writeProcedure } from "../index";
import { eventBus } from "../lib/events";

const incidentTimestampSchema = z.coerce.date();

const incidentStatusSchema = z.enum([
	"investigating",
	"identified",
	"monitoring",
	"resolved",
]);

const incidentUpdateInputSchema = z.object({
	id: z.string(),
	title: z.string().min(1),
	description: z.string().optional(),
	severity: z.enum(["minor", "major", "critical"]),
	startedAt: incidentTimestampSchema,
	endedAt: incidentTimestampSchema.nullable().optional(),
	monitorIds: z.array(z.string()).default([]),
	statusPageIds: z.array(z.string()).default([]),
});

function getActiveOrganizationId(
	activeOrganizationId: string | null | undefined,
) {
	if (!activeOrganizationId) {
		throw new ORPCError("UNAUTHORIZED", {
			message: "No active organization",
		});
	}

	return activeOrganizationId;
}

function ensureValidTimeline(startedAt: Date, endedAt: Date | null) {
	if (endedAt && endedAt.getTime() < startedAt.getTime()) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Incident end time cannot be before the start time",
		});
	}
}

function formatTimelineChange(
	label: string,
	previous: Date | null,
	next: Date | null,
) {
	const previousText = previous ? previous.toISOString() : "unset";
	const nextText = next ? next.toISOString() : "unset";
	return `${label} changed from ${previousText} to ${nextText}`;
}

function deriveStatusForEndedAt(
	existingStatus: string,
	acknowledgedAt: Date | null,
	endedAt: Date | null,
) {
	if (endedAt) {
		return "resolved";
	}

	if (existingStatus === "resolved") {
		return acknowledgedAt ? "identified" : "investigating";
	}

	return existingStatus as z.infer<typeof incidentStatusSchema>;
}

async function assertOrganizationResources(
	organizationId: string,
	monitorIds: string[],
	statusPageIds: string[],
) {
	const [matchingMonitors, matchingStatusPages] = await Promise.all([
		monitorIds.length
			? db
					.select({ id: monitor.id })
					.from(monitor)
					.where(
						and(
							eq(monitor.organizationId, organizationId),
							inArray(monitor.id, monitorIds),
						),
					)
			: Promise.resolve([]),
		statusPageIds.length
			? db
					.select({ id: statusPage.id })
					.from(statusPage)
					.where(
						and(
							eq(statusPage.organizationId, organizationId),
							inArray(statusPage.id, statusPageIds),
						),
					)
			: Promise.resolve([]),
	]);

	if (matchingMonitors.length !== monitorIds.length) {
		throw new ORPCError("BAD_REQUEST", {
			message: "One or more monitors do not belong to the active organization",
		});
	}

	if (matchingStatusPages.length !== statusPageIds.length) {
		throw new ORPCError("BAD_REQUEST", {
			message:
				"One or more status pages do not belong to the active organization",
		});
	}
}

export const incidentsRouter = {
	list: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/incidents",
				tags: ["Incident Management"],
				summary: "List incidents",
				description: "Retrieve a list of incidents with optional filtering.",
			},
		})
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
					getActiveOrganizationId(context.session.session.activeOrganizationId),
				),
			];

			if (input.status === "open") {
				filters.push(isNull(incident.endedAt));
			} else if (input.status === "resolved") {
				filters.push(sql`${incident.endedAt} IS NOT NULL`);
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
					orderBy: [desc(incident.startedAt)],
					with: {
						monitors: {
							with: {
								monitor: true,
							},
						},
						statusPages: {
							with: {
								statusPage: true,
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
		.meta({
			openapi: {
				method: "GET",
				path: "/incidents/{id}",
				tags: ["Incident Management"],
				summary: "Get incident",
				description: "Retrieve details of a specific incident.",
			},
		})
		.input(z.object({ id: z.string() }))
		.handler(async ({ input, context }) => {
			const item = await db.query.incident.findFirst({
				where: and(
					eq(incident.id, input.id),
					eq(
						incident.organizationId,
						getActiveOrganizationId(
							context.session.session.activeOrganizationId,
						),
					),
				),
				with: {
					monitors: {
						with: {
							monitor: true,
						},
					},
					statusPages: {
						with: {
							statusPage: true,
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
		.meta({
			openapi: {
				method: "POST",
				path: "/incidents",
				tags: ["Incident Management"],
				summary: "Create incident",
				description: "Create a new incident.",
			},
		})
		.input(
			z.object({
				title: z.string().min(1),
				description: z.string().optional(),
				severity: z.enum(["minor", "major", "critical"]),
				monitorIds: z.array(z.string()).default([]),
				statusPageIds: z.array(z.string()).default([]),
				startedAt: incidentTimestampSchema.optional(),
				endedAt: incidentTimestampSchema.nullable().optional(),
			}),
		)
		.handler(async ({ input, context }) => {
			const id = crypto.randomUUID();
			const now = new Date();
			const startedAt = input.startedAt ?? now;
			const endedAt = input.endedAt ?? null;
			const status = endedAt ? "resolved" : "investigating";
			const organizationId = getActiveOrganizationId(
				context.session.session.activeOrganizationId,
			);

			ensureValidTimeline(startedAt, endedAt);
			await assertOrganizationResources(
				organizationId,
				input.monitorIds,
				input.statusPageIds,
			);

			await db.transaction(async (tx) => {
				await tx.insert(incident).values({
					id,
					organizationId,
					title: input.title,
					description: input.description,
					severity: input.severity,
					status,
					type: "manual",
					startedAt,
					endedAt,
					createdAt: now,
					updatedAt: now,
					resolvedAt: endedAt,
				});

				if (input.monitorIds.length > 0) {
					await tx.insert(incidentMonitor).values(
						input.monitorIds.map((mid) => ({
							incidentId: id,
							monitorId: mid,
						})),
					);
				}

				if (input.statusPageIds.length > 0) {
					await tx.insert(incidentStatusPage).values(
						input.statusPageIds.map((statusPageId) => ({
							incidentId: id,
							statusPageId,
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

				if (input.statusPageIds.length > 0) {
					await tx.insert(incidentActivity).values({
						id: crypto.randomUUID(),
						incidentId: id,
						message: `Published to ${input.statusPageIds.length} status page${input.statusPageIds.length === 1 ? "" : "s"}`,
						type: "event",
						createdAt: now,
						userId: context.session.user.id,
					});
				}
			});

			eventBus.emit("incident.created", {
				incidentId: id,
				organizationId,
				title: input.title,
				description: input.description,
				severity: input.severity,
			});

			return { id };
		}),

	update: writeProcedure
		.meta({
			openapi: {
				method: "PATCH",
				path: "/incidents/{id}",
				tags: ["Incident Management"],
				summary: "Update incident",
				description:
					"Update incident metadata, timeline, monitors, and publishing.",
			},
		})
		.input(incidentUpdateInputSchema)
		.handler(async ({ input, context }) => {
			const organizationId = getActiveOrganizationId(
				context.session.session.activeOrganizationId,
			);
			const existing = await db.query.incident.findFirst({
				where: and(
					eq(incident.id, input.id),
					eq(incident.organizationId, organizationId),
				),
				with: {
					monitors: true,
					statusPages: {
						with: {
							statusPage: true,
						},
					},
				},
			});

			if (!existing) {
				throw new ORPCError("NOT_FOUND", { message: "Incident not found" });
			}

			const endedAt = input.endedAt ?? null;
			ensureValidTimeline(input.startedAt, endedAt);
			await assertOrganizationResources(
				organizationId,
				input.monitorIds,
				input.statusPageIds,
			);

			const nextStatus = deriveStatusForEndedAt(
				existing.status,
				existing.acknowledgedAt,
				endedAt,
			);
			const previousMonitorIds = existing.monitors.map(
				(item) => item.monitorId,
			);
			const previousStatusPageIds = existing.statusPages.map(
				(item) => item.statusPageId,
			);
			const monitorsToAdd = input.monitorIds.filter(
				(id) => !previousMonitorIds.includes(id),
			);
			const monitorsToRemove = previousMonitorIds.filter(
				(id) => !input.monitorIds.includes(id),
			);
			const statusPagesToAdd = input.statusPageIds.filter(
				(id) => !previousStatusPageIds.includes(id),
			);
			const statusPagesToRemove = previousStatusPageIds.filter(
				(id) => !input.statusPageIds.includes(id),
			);
			const activityMessages: string[] = [];

			if (existing.startedAt.getTime() !== input.startedAt.getTime()) {
				activityMessages.push(
					formatTimelineChange(
						"Incident start time",
						existing.startedAt,
						input.startedAt,
					),
				);
			}

			const existingEndedAt = existing.endedAt ?? null;
			if (
				(existingEndedAt?.getTime() ?? null) !== (endedAt?.getTime() ?? null)
			) {
				activityMessages.push(
					formatTimelineChange("Incident end time", existingEndedAt, endedAt),
				);
			}

			if (statusPagesToAdd.length > 0) {
				activityMessages.push(
					`Published to ${statusPagesToAdd.length} additional status page${statusPagesToAdd.length === 1 ? "" : "s"}`,
				);
			}

			if (statusPagesToRemove.length > 0) {
				activityMessages.push(
					`Removed from ${statusPagesToRemove.length} status page${statusPagesToRemove.length === 1 ? "" : "s"}`,
				);
			}

			await db.transaction(async (tx) => {
				await tx
					.update(incident)
					.set({
						title: input.title,
						description: input.description,
						severity: input.severity,
						startedAt: input.startedAt,
						endedAt,
						status: nextStatus,
						resolvedAt: endedAt,
						updatedAt: new Date(),
					})
					.where(eq(incident.id, input.id));

				if (monitorsToRemove.length > 0) {
					await tx
						.delete(incidentMonitor)
						.where(
							and(
								eq(incidentMonitor.incidentId, input.id),
								inArray(incidentMonitor.monitorId, monitorsToRemove),
							),
						);
				}

				if (monitorsToAdd.length > 0) {
					await tx.insert(incidentMonitor).values(
						monitorsToAdd.map((monitorId) => ({
							incidentId: input.id,
							monitorId,
						})),
					);
				}

				if (statusPagesToRemove.length > 0) {
					await tx
						.delete(incidentStatusPage)
						.where(
							and(
								eq(incidentStatusPage.incidentId, input.id),
								inArray(incidentStatusPage.statusPageId, statusPagesToRemove),
							),
						);
				}

				if (statusPagesToAdd.length > 0) {
					await tx.insert(incidentStatusPage).values(
						statusPagesToAdd.map((statusPageId) => ({
							incidentId: input.id,
							statusPageId,
						})),
					);
				}

				if (activityMessages.length > 0) {
					await tx.insert(incidentActivity).values(
						activityMessages.map((message) => ({
							id: crypto.randomUUID(),
							incidentId: input.id,
							message,
							type: "event",
							createdAt: new Date(),
							userId: context.session.user.id,
						})),
					);
				}
			});

			return { success: true };
		}),

	acknowledge: writeProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/incidents/{id}/acknowledge",
				tags: ["Incident Management"],
				summary: "Acknowledge incident",
				description: "Mark an incident as acknowledged.",
			},
		})
		.input(z.object({ id: z.string() }))
		.handler(async ({ input, context }) => {
			const now = new Date();

			const existing = await db.query.incident.findFirst({
				where: and(
					eq(incident.id, input.id),
					eq(
						incident.organizationId,
						getActiveOrganizationId(
							context.session.session.activeOrganizationId,
						),
					),
				),
			});

			if (!existing) {
				throw new ORPCError("NOT_FOUND", { message: "Incident not found" });
			}

			if (existing.acknowledgedAt) {
				return { success: true, message: "Already acknowledged" };
			}

			await db.transaction(async (tx) => {
				await tx
					.update(incident)
					.set({
						status: existing.endedAt ? "resolved" : "identified",
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
		.meta({
			openapi: {
				method: "POST",
				path: "/incidents/{id}/resolve",
				tags: ["Incident Management"],
				summary: "Resolve incident",
				description: "Mark an incident as resolved.",
			},
		})
		.input(z.object({ id: z.string() }))
		.handler(async ({ input, context }) => {
			const now = new Date();

			const existing = await db.query.incident.findFirst({
				where: and(
					eq(incident.id, input.id),
					eq(
						incident.organizationId,
						getActiveOrganizationId(
							context.session.session.activeOrganizationId,
						),
					),
				),
			});

			if (!existing) {
				throw new ORPCError("NOT_FOUND", { message: "Incident not found" });
			}

			if (existing.endedAt) {
				return { success: true, message: "Already resolved" };
			}

			await db.transaction(async (tx) => {
				await tx
					.update(incident)
					.set({
						status: "resolved",
						endedAt: now,
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
		.meta({
			openapi: {
				method: "POST",
				path: "/incidents/{incidentId}/comments",
				tags: ["incidents"],
				summary: "Add comment",
				description: "Add a comment to an incident.",
			},
		})
		.input(z.object({ incidentId: z.string(), message: z.string().min(1) }))
		.handler(async ({ input, context }) => {
			const now = new Date();
			const existing = await db.query.incident.findFirst({
				where: and(
					eq(incident.id, input.incidentId),
					eq(
						incident.organizationId,
						getActiveOrganizationId(
							context.session.session.activeOrganizationId,
						),
					),
				),
			});

			if (!existing) {
				throw new ORPCError("NOT_FOUND", { message: "Incident not found" });
			}

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

	delete: writeProcedure
		.meta({
			openapi: {
				method: "DELETE",
				path: "/incidents/{id}",
				tags: ["Incident Management"],
				summary: "Delete incident",
				description: "Delete a specific incident by ID.",
			},
		})
		.input(z.object({ id: z.string() }))
		.handler(async ({ input, context }) => {
			const existing = await db.query.incident.findFirst({
				where: and(
					eq(incident.id, input.id),
					eq(
						incident.organizationId,
						getActiveOrganizationId(
							context.session.session.activeOrganizationId,
						),
					),
				),
			});

			if (!existing) {
				throw new ORPCError("NOT_FOUND", { message: "Incident not found" });
			}

			await db.delete(incident).where(eq(incident.id, input.id));

			eventBus.emit("incident.deleted", {
				incidentId: input.id,
				organizationId: existing.organizationId,
				title: existing.title,
				severity: existing.severity as any,
			});

			return { success: true };
		}),
};
