import { db } from "@uptimekit/db";
import { monitor, monitorGroup } from "@uptimekit/db/schema/monitors";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../index";
import { ORPCError } from "@orpc/server";

export const monitorsRouter = {
	list: protectedProcedure.handler(async ({ context }) => {
		const monitors = await db
			.select()
			.from(monitor)
            .leftJoin(monitorGroup, eq(monitor.groupId, monitorGroup.id))
			.where(eq(monitor.organizationId, context.session.session.activeOrganizationId!))
			.orderBy(desc(monitor.createdAt));

		return monitors.map((row) => ({
            ...row.monitor,
            group: row.monitor_group || null,
        }));
	}),

    listGroups: protectedProcedure
        .handler(async ({ context }) => {
            const groups = await db
                .select()
                .from(monitorGroup)
                .where(eq(monitorGroup.organizationId, context.session.session.activeOrganizationId!))
                .orderBy(desc(monitorGroup.createdAt));
            return groups;
        }),

    createGroup: protectedProcedure
        .input(z.object({ name: z.string().min(1) }))
        .handler(async ({ input, context }) => {
            const [newGroup] = await db
                .insert(monitorGroup)
                .values({
                    id: crypto.randomUUID(),
                    name: input.name,
                    organizationId: context.session.session.activeOrganizationId!,
                })
                .returning();
            return newGroup;
        }),

	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1),
				type: z.enum(["http", "http-json", "tcp", "ping", "dns", "keyword"]), 
                interval: z.number().min(30).default(60),
                groupId: z.string().optional(),
                config: z.record(z.any(), z.any()),
                locations: z.array(z.string()).min(1), // Require at least one location
                incidentPendingDuration: z.number().min(0).default(0),
                incidentRecoveryDuration: z.number().min(0).default(0),
			}),
		)
		.handler(async ({ input, context }) => {
			const [newMonitor] = await db
				.insert(monitor)
				.values({
					id: crypto.randomUUID(),
					name: input.name,
					organizationId: context.session.session.activeOrganizationId!,
					type: input.type,
					config: input.config, 
					locations: input.locations,
                    groupId: input.groupId,
					active: true,
                    incidentPendingDuration: input.incidentPendingDuration,
                    incidentRecoveryDuration: input.incidentRecoveryDuration,
				})
				.returning();

			if (!newMonitor) {
				throw new ORPCError("INTERNAL_SERVER_ERROR");
			}

			return newMonitor;
		}),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .handler(async ({ input, context }) => {
             // Verify ownership
            const existing = await db.query.monitor.findFirst({
                where: eq(monitor.id, input.id),
            });

            if (!existing || existing.organizationId !== context.session.session.activeOrganizationId) {
                throw new ORPCError("NOT_FOUND");
            }

            await db.delete(monitor).where(eq(monitor.id, input.id));
            return { success: true };
        }),

    toggle: protectedProcedure
        .input(z.object({ id: z.string(), active: z.boolean() }))
        .handler(async ({ input, context }) => {
             const existing = await db.query.monitor.findFirst({
                where: eq(monitor.id, input.id),
            });

            if (!existing || existing.organizationId !== context.session.session.activeOrganizationId) {
                throw new ORPCError("NOT_FOUND");
            }

            await db
                .update(monitor)
                .set({ active: input.active })
                .where(eq(monitor.id, input.id));
            
            return { success: true };
        }),

    update: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                name: z.string().min(1),
                type: z.enum(["http", "http-json", "tcp", "ping", "dns", "keyword"]), 
                interval: z.number().min(30).default(60),
                groupId: z.string().optional(),
                config: z.record(z.any(), z.any()),
                locations: z.array(z.string()).min(1),
                incidentPendingDuration: z.number().min(0).default(0),
                incidentRecoveryDuration: z.number().min(0).default(0),
                active: z.boolean().default(true),
            })
        )
        .handler(async ({ input, context }) => {
            const existing = await db.query.monitor.findFirst({
                where: eq(monitor.id, input.id),
            });

            if (!existing || existing.organizationId !== context.session.session.activeOrganizationId) {
                throw new ORPCError("NOT_FOUND");
            }

            await db
                .update(monitor)
                .set({
                    name: input.name,
                    type: input.type,
                    interval: input.interval,
                    groupId: input.groupId,
                    config: input.config,
                    locations: input.locations,
                    incidentPendingDuration: input.incidentPendingDuration,
                    incidentRecoveryDuration: input.incidentRecoveryDuration,
                    active: input.active,
                })
                .where(eq(monitor.id, input.id));

            return { success: true };
        }),
};
