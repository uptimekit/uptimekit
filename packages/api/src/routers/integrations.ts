import { ORPCError } from "@orpc/server"; /* manually added ORPCError import */
import { db } from "@uptimekit/db";
import {
	integrationConfig,
	monitorNotification,
} from "@uptimekit/db/schema/integrations";
import { monitor } from "@uptimekit/db/schema/monitors";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, writeProcedure } from "../index";
import { assertSafeWebhookUrl } from "../lib/safe-url";
import { integrationRegistry } from "../pkg/integrations/registry";

export const integrationsRouter = {
	listAvailable: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/integrations/available",
				tags: ["Integration Management"],
				summary: "List available integrations",
				description: "List all supported integration types.",
			},
		})
		.handler(async () => {
			const integrations = integrationRegistry.list();
			return integrations.map((i) => ({
				id: i.id,
				name: i.name,
				type: i.type,
				logo: i.logo,
				description: i.description,
				events: i.events,
			}));
		}),

	listConfigured: writeProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/integrations/configured",
				tags: ["Integration Management"],
				summary: "List configured integrations",
				description: "List all integrations configured for the organization.",
			},
		})
		.handler(async ({ context }) => {
			const organizationId = context.session.session.activeOrganizationId;
			if (!organizationId) return [];

			const configs = await db.query.integrationConfig.findMany({
				where: (t, { eq }) => eq(t.organizationId, organizationId),
				with: {
					monitorNotifications: true,
				},
			});

			return configs.map(({ monitorNotifications, ...config }) => ({
				...config,
				assignedMonitorCount: monitorNotifications.length,
			}));
		}),

	configure: writeProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/integrations/configure",
				tags: ["Integration Management"],
				summary: "Configure integration",
				description: "Create or update an integration configuration.",
			},
		})
		.input(
			z.object({
				id: z.string().optional(),
				name: z.string().trim().min(1),
				type: z.string(),
				config: z.record(z.any(), z.any()), // We accept any JSON, validation happens inside or before
				active: z.boolean().default(true),
				isDefault: z.boolean().default(false),
				applyToExistingMonitors: z.boolean().default(false),
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

			const parsedConfig = integrationDef.configSchema.parse(input.config);
			if (input.type === "webhook") {
				await assertSafeWebhookUrl(parsedConfig.url);
			}

			const notificationId = input.id ?? crypto.randomUUID();

			await db.transaction(async (tx) => {
				if (input.id) {
					const inputId = input.id;
					const existing = await tx.query.integrationConfig.findFirst({
						where: (t, { eq, and }) =>
							and(eq(t.id, inputId), eq(t.organizationId, organizationId)),
					});

					if (!existing) {
						throw new ORPCError("NOT_FOUND", {
							message: "Integration not found",
						});
					}

					await tx
						.update(integrationConfig)
						.set({
							name: input.name,
							type: input.type,
							config: parsedConfig,
							active: input.active,
							isDefault: input.isDefault,
							updatedAt: new Date(),
						})
						.where(eq(integrationConfig.id, existing.id));
				} else {
					await tx.insert(integrationConfig).values({
						id: notificationId,
						name: input.name,
						organizationId,
						type: input.type,
						config: parsedConfig,
						active: input.active,
						isDefault: input.isDefault,
					});
				}

				if (input.applyToExistingMonitors) {
					const monitors = await tx
						.select({ id: monitor.id })
						.from(monitor)
						.where(eq(monitor.organizationId, organizationId));

					if (monitors.length > 0) {
						await tx
							.insert(monitorNotification)
							.values(
								monitors.map((monitorRecord) => ({
									monitorId: monitorRecord.id,
									integrationConfigId: notificationId,
								})),
							)
							.onConflictDoNothing();
					}
				}
			});

			return { success: true, id: notificationId };
		}),

	delete: writeProcedure
		.meta({
			openapi: {
				method: "DELETE",
				path: "/integrations/{id}",
				tags: ["Integration Management"],
				summary: "Delete integration",
				description: "Remove an integration configuration.",
			},
		})
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
		.meta({
			openapi: {
				method: "POST",
				path: "/integrations/{id}/toggle",
				tags: ["integrations"],
				summary: "Toggle integration",
				description: "Enable or disable an integration.",
			},
		})
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

	test: writeProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/integrations/{id}/test",
				tags: ["Integration Management"],
				summary: "Test integration",
				description: "Send a test event to verify the integration is working.",
			},
		})
		.input(z.object({ id: z.string() }))
		.handler(async ({ context, input }) => {
			const organizationId = context.session.session.activeOrganizationId;
			if (!organizationId) throw new Error("No organization selected");

			const config = await db.query.integrationConfig.findFirst({
				where: (t, { eq, and }) =>
					and(eq(t.id, input.id), eq(t.organizationId, organizationId)),
			});

			if (!config) {
				throw new ORPCError("NOT_FOUND", {
					message: "Integration not found",
				});
			}

			const integration = integrationRegistry.get(config.type);
			if (!integration) {
				throw new ORPCError("NOT_FOUND", {
					message: "Integration type not found",
				});
			}

			const testEvent = "integration.test";
			const testPayload = {
				organizationId,
				incidentId: "test-incident-id",
				title: "Test Incident",
				description:
					"This is a test incident to verify your integration is working correctly.",
				severity: "info",
				status: "investigating",
				createdAt: new Date().toISOString(),
			};

			try {
				if (config.type === "webhook") {
					await assertSafeWebhookUrl((config.config as { url: string }).url);
				}
				await integration.handler(config.config, testEvent, testPayload);
				return { success: true, message: "Test event sent successfully" };
			} catch (error: any) {
				const isWebhookValidationError =
					config.type === "webhook" && error instanceof Error;

				throw new ORPCError(
					isWebhookValidationError ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR",
					{
						message: `Failed to send test event: ${error.message}`,
					},
				);
			}
		}),
};
