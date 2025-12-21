import { ORPCError } from "@orpc/server"; /* manually added ORPCError import */
import { db } from "@uptimekit/db";
import { integrationConfig } from "@uptimekit/db/schema/integrations";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, writeProcedure } from "../index";
import {
	ALLOWED_INTEGRATIONS,
	hasActiveSubscription,
	isSelfHosted,
} from "../lib/limits";
import { integrationRegistry } from "../pkg/integrations/registry";

export const integrationsRouter = {
	listAvailable: protectedProcedure.handler(async () => {
		const integrations = integrationRegistry.list();
		return integrations.map((i) => ({
			id: i.id,
			name: i.name,
			description: i.description,
			events: i.events,
		}));
	}),

	listConfigured: writeProcedure.handler(async ({ context }) => {
		const organizationId = context.session.session.activeOrganizationId;
		if (!organizationId) return [];

		const configs = await db.query.integrationConfig.findMany({
			where: (t, { eq }) => eq(t.organizationId, organizationId),
		});

		return configs;
	}),

	configure: writeProcedure
		.input(
			z.object({
				type: z.string(),
				config: z.record(z.any(), z.any()), // We accept any JSON, validation happens inside or before
				active: z.boolean().default(true),
			}),
		)
		.handler(async ({ context, input }) => {
			const organizationId = context.session.session.activeOrganizationId;
			if (!organizationId) throw new Error("No organization selected");

			// Server-side validation
			const integrationDef = integrationRegistry.get(input.type);
			if (!integrationDef) {
				throw new Error("Invalid integration type");
			}

			if (!isSelfHosted()) {
				const hasSub = await hasActiveSubscription(
					organizationId,
					context.headers,
				);
				if (!hasSub && !ALLOWED_INTEGRATIONS.includes(input.type)) {
					throw new ORPCError("FORBIDDEN", {
						message: "This integration is not available on your plan.",
					});
				}
			}

			const parsedConfig = integrationDef.configSchema.parse(input.config);

			// Check if exists
			const existing = await db.query.integrationConfig.findFirst({
				where: (t, { eq, and }) =>
					and(eq(t.organizationId, organizationId), eq(t.type, input.type)),
			});

			if (existing) {
				await db
					.update(integrationConfig)
					.set({
						config: parsedConfig,
						active: input.active,
						updatedAt: new Date(),
					})
					.where(eq(integrationConfig.id, existing.id));
			} else {
				await db.insert(integrationConfig).values({
					id: crypto.randomUUID(),
					organizationId,
					type: input.type,
					config: parsedConfig,
					active: input.active,
				});
			}

			return { success: true };
		}),

	delete: writeProcedure
		.input(z.object({ id: z.string() }))
		.handler(async ({ context, input }) => {
			const organizationId = context.session.session.activeOrganizationId;
			if (!organizationId) throw new Error("No organization selected");

			await db
				.delete(integrationConfig)
				.where(
					and(
						eq(integrationConfig.id, input.id),
						eq(integrationConfig.organizationId, organizationId),
					),
				);
			return { success: true };
		}),

	toggle: writeProcedure
		.input(z.object({ id: z.string(), active: z.boolean() }))
		.handler(async ({ context, input }) => {
			const organizationId = context.session.session.activeOrganizationId;
			if (!organizationId) throw new Error("No organization selected");

			await db
				.update(integrationConfig)
				.set({ active: input.active })
				.where(
					and(
						eq(integrationConfig.id, input.id),
						eq(integrationConfig.organizationId, organizationId),
					),
				);
			return { success: true };
		}),
};
