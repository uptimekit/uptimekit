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
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, writeProcedure } from "../index";

const maintenanceStatusSchema = z.enum([
    "scheduled",
    "in_progress",
    "completed",
]);

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

function getMaintenanceStatus(item: {
    startedAt: Date;
    plannedEndAt?: Date | null;
    endedAt: Date | null;
}) {
    const now = new Date();

    if (item.endedAt) return "completed";
    if (item.plannedEndAt && item.plannedEndAt <= now) return "completed";
    if (item.startedAt > now) return "scheduled";
    return "in_progress";
}

function toMaintenance<T extends { startedAt: Date; endedAt: Date | null }>(
    item: T,
) {
    return {
        ...item,
        status: getMaintenanceStatus(item),
        startAt: item.startedAt,
        endAt: "plannedEndAt" in item ? item.plannedEndAt : item.endedAt,
    };
}

async function assertStatusPage(organizationId: string, statusPageId: string) {
    const page = await db.query.statusPage.findFirst({
        where: and(
            eq(statusPage.id, statusPageId),
            eq(statusPage.organizationId, organizationId),
        ),
    });

    if (!page) {
        throw new ORPCError("NOT_FOUND", {
            message: "Status page not found",
        });
    }
}

async function assertMonitors(organizationId: string, monitorIds: string[]) {
    if (monitorIds.length === 0) return;

    const rows = await db
        .select({ id: monitor.id })
        .from(monitor)
        .where(
            and(
                eq(monitor.organizationId, organizationId),
                inArray(monitor.id, monitorIds),
            ),
        );

    if (rows.length !== monitorIds.length) {
        throw new ORPCError("BAD_REQUEST", {
            message:
                "One or more monitors do not belong to the active organization",
        });
    }
}

export const maintenanceRouter = {
    list: protectedProcedure
        .route({
            method: "GET",
            path: "/maintenance",
            tags: ["Status Page Management"],
            summary: "List maintenance windows",
        })
        .input(z.object({ statusPageId: z.string() }))
        .handler(async ({ input, context }) => {
            const organizationId = getActiveOrganizationId(
                context.session.session.activeOrganizationId,
            );
            await assertStatusPage(organizationId, input.statusPageId);

            const records = await db.query.incident.findMany({
                where: and(
                    eq(incident.organizationId, organizationId),
                    eq(incident.severity, "maintenance"),
                    inArray(
                        incident.id,
                        db
                            .select({
                                incidentId: incidentStatusPage.incidentId,
                            })
                            .from(incidentStatusPage)
                            .where(
                                eq(
                                    incidentStatusPage.statusPageId,
                                    input.statusPageId,
                                ),
                            ),
                    ),
                ),
                orderBy: [desc(incident.startedAt)],
            });

            return records.map(toMaintenance);
        }),

    create: writeProcedure
        .route({
            method: "POST",
            path: "/maintenance",
            tags: ["Status Page Management"],
            summary: "Create maintenance",
        })
        .input(
            z.object({
                statusPageId: z.string(),
                title: z.string().min(1),
                description: z.string().optional(),
                startAt: z.string().datetime(),
                endAt: z.string().datetime(),
                status: maintenanceStatusSchema,
                monitorIds: z.array(z.string()).optional(),
            }),
        )
        .handler(async ({ input, context }) => {
            const organizationId = getActiveOrganizationId(
                context.session.session.activeOrganizationId,
            );
            const monitorIds = input.monitorIds ?? [];
            await assertStatusPage(organizationId, input.statusPageId);
            await assertMonitors(organizationId, monitorIds);

            const id = crypto.randomUUID();
            const now = new Date();
            const startAt = new Date(input.startAt);
            const endAt = new Date(input.endAt);
            const isCompleted = input.status === "completed";

            await db.transaction(async (tx) => {
                await tx.insert(incident).values({
                    id,
                    organizationId,
                    title: input.title,
                    description: input.description,
                    status: isCompleted
                        ? "resolved"
                        : input.status === "in_progress"
                          ? "monitoring"
                          : "investigating",
                    severity: "maintenance",
                    type: "manual",
                    startedAt: startAt,
                    plannedEndAt: endAt,
                    endedAt: isCompleted ? endAt : null,
                    resolvedAt: isCompleted ? endAt : null,
                    createdAt: now,
                    updatedAt: now,
                });

                await tx.insert(incidentStatusPage).values({
                    incidentId: id,
                    statusPageId: input.statusPageId,
                });

                if (monitorIds.length > 0) {
                    await tx.insert(incidentMonitor).values(
                        monitorIds.map((monitorId) => ({
                            incidentId: id,
                            monitorId,
                        })),
                    );
                }

                if (input.description) {
                    await tx.insert(incidentActivity).values({
                        id: crypto.randomUUID(),
                        incidentId: id,
                        message: input.description,
                        type: "comment",
                        createdAt: now,
                        userId: context.session.user.id,
                    });
                }
            });

            return { id };
        }),

    get: protectedProcedure
        .route({
            method: "GET",
            path: "/maintenance/{maintenanceId}",
            tags: ["Status Page Management"],
            summary: "Get maintenance",
        })
        .input(z.object({ maintenanceId: z.string() }))
        .handler(async ({ input, context }) => {
            const organizationId = getActiveOrganizationId(
                context.session.session.activeOrganizationId,
            );
            const record = await db.query.incident.findFirst({
                where: and(
                    eq(incident.id, input.maintenanceId),
                    eq(incident.organizationId, organizationId),
                    eq(incident.severity, "maintenance"),
                ),
                with: {
                    activities: { orderBy: [desc(incidentActivity.createdAt)] },
                    monitors: { with: { monitor: true } },
                },
            });

            if (!record) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Maintenance not found",
                });
            }

            return { ...toMaintenance(record), updates: record.activities };
        }),

    update: writeProcedure
        .route({
            method: "PATCH",
            path: "/maintenance/{maintenanceId}",
            tags: ["Status Page Management"],
            summary: "Update maintenance",
        })
        .input(
            z.object({
                maintenanceId: z.string(),
                startAt: z.string().datetime(),
                endAt: z.string().datetime(),
            }),
        )
        .handler(async ({ input, context }) => {
            const organizationId = getActiveOrganizationId(
                context.session.session.activeOrganizationId,
            );
            await db
                .update(incident)
                .set({
                    startedAt: new Date(input.startAt),
                    plannedEndAt: new Date(input.endAt),
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(incident.id, input.maintenanceId),
                        eq(incident.organizationId, organizationId),
                        eq(incident.severity, "maintenance"),
                    ),
                );

            return { success: true };
        }),

    createUpdate: writeProcedure
        .route({
            method: "POST",
            path: "/maintenance/{maintenanceId}/updates",
            tags: ["Status Page Management"],
            summary: "Create maintenance update",
        })
        .input(
            z.object({
                maintenanceId: z.string(),
                message: z.string().min(1),
                status: maintenanceStatusSchema,
            }),
        )
        .handler(async ({ input, context }) => {
            const organizationId = getActiveOrganizationId(
                context.session.session.activeOrganizationId,
            );
            const record = await db.query.incident.findFirst({
                where: and(
                    eq(incident.id, input.maintenanceId),
                    eq(incident.organizationId, organizationId),
                    eq(incident.severity, "maintenance"),
                ),
            });

            if (!record) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Maintenance not found",
                });
            }

            const now = new Date();
            const updateId = crypto.randomUUID();
            const values: Partial<typeof incident.$inferSelect> = {
                status:
                    input.status === "completed"
                        ? "resolved"
                        : input.status === "in_progress"
                          ? "monitoring"
                          : "investigating",
                updatedAt: now,
            };

            if (input.status === "in_progress" && record.startedAt > now) {
                values.startedAt = now;
            }

            if (input.status === "completed") {
                values.endedAt = now;
                values.resolvedAt = now;
            }

            await db.transaction(async (tx) => {
                await tx.insert(incidentActivity).values({
                    id: updateId,
                    incidentId: input.maintenanceId,
                    message: input.message,
                    type: "comment",
                    createdAt: now,
                    userId: context.session.user.id,
                });

                await tx
                    .update(incident)
                    .set(values)
                    .where(eq(incident.id, input.maintenanceId));
            });

            return { id: updateId };
        }),

    updateUpdate: writeProcedure
        .route({
            method: "PATCH",
            path: "/maintenance/updates/{updateId}",
            tags: ["Status Page Management"],
            summary: "Modify maintenance update",
        })
        .input(
            z.object({
                updateId: z.string(),
                message: z.string().min(1),
                status: maintenanceStatusSchema.optional(),
            }),
        )
        .handler(async ({ input, context }) => {
            const organizationId = getActiveOrganizationId(
                context.session.session.activeOrganizationId,
            );
            const update = await db.query.incidentActivity.findFirst({
                where: eq(incidentActivity.id, input.updateId),
                with: { incident: true },
            });

            if (
                !update ||
                update.incident.organizationId !== organizationId ||
                update.incident.severity !== "maintenance"
            ) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Update not found or access denied",
                });
            }

            await db
                .update(incidentActivity)
                .set({ message: input.message })
                .where(eq(incidentActivity.id, input.updateId));

            return { success: true };
        }),

    deleteUpdate: writeProcedure
        .route({
            method: "DELETE",
            path: "/maintenance/updates/{updateId}",
            tags: ["maintenance"],
            summary: "Delete maintenance update",
        })
        .input(z.object({ updateId: z.string() }))
        .handler(async ({ input, context }) => {
            const organizationId = getActiveOrganizationId(
                context.session.session.activeOrganizationId,
            );
            const update = await db.query.incidentActivity.findFirst({
                where: eq(incidentActivity.id, input.updateId),
                with: { incident: { with: { activities: true } } },
            });

            if (
                !update ||
                update.incident.organizationId !== organizationId ||
                update.incident.severity !== "maintenance"
            ) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Update not found or access denied",
                });
            }

            if (update.incident.activities.length <= 1) {
                throw new ORPCError("BAD_REQUEST", {
                    message:
                        "Cannot delete the last update from a maintenance window.",
                });
            }

            await db
                .delete(incidentActivity)
                .where(eq(incidentActivity.id, input.updateId));

            return { success: true };
        }),

    delete: writeProcedure
        .route({
            method: "DELETE",
            path: "/maintenance/{maintenanceId}",
            tags: ["Status Page Management"],
            summary: "Delete maintenance",
        })
        .input(z.object({ maintenanceId: z.string() }))
        .handler(async ({ input, context }) => {
            const organizationId = getActiveOrganizationId(
                context.session.session.activeOrganizationId,
            );
            await db
                .delete(incident)
                .where(
                    and(
                        eq(incident.id, input.maintenanceId),
                        eq(incident.organizationId, organizationId),
                        eq(incident.severity, "maintenance"),
                    ),
                );

            return { success: true };
        }),
};
