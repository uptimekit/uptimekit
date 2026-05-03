import { db } from "@uptimekit/db";
import { incidentMonitor } from "@uptimekit/db/schema/incidents";
import {
	integrationConfig,
	monitorNotification,
} from "@uptimekit/db/schema/integrations";
import { and, eq, inArray } from "drizzle-orm";
import { eventBus } from "../../lib/events";
import { alertManagerIntegration } from "./definitions/alertmanager";
import { discordIntegration } from "./definitions/discord";
import { telegramIntegration } from "./definitions/telegram";
import { webhookIntegration } from "./definitions/webhook";
import { integrationRegistry } from "./registry";

// Register built-in integrations
integrationRegistry.register(webhookIntegration);
integrationRegistry.register(discordIntegration);
integrationRegistry.register(telegramIntegration);
integrationRegistry.register(alertManagerIntegration);

export function dedupeNotificationConfigs<TConfig extends { id: string }>(
	configs: TConfig[],
) {
	const configsById = new Map<string, TConfig>();

	for (const config of configs) {
		if (!configsById.has(config.id)) {
			configsById.set(config.id, config);
		}
	}

	return Array.from(configsById.values());
}

export class IntegrationService {
	constructor() {
		this.setupListeners();
	}

	private setupListeners() {
		const events = [
			"incident.created",
			"incident.acknowledged",
			"incident.resolved",
			"incident.comment_added",
		] as const;

		for (const eventName of events) {
			eventBus.on(eventName, async (payload) => {
				await this.handleEvent(eventName, payload);
			});
		}
	}

	private async handleEvent(event: string, payload: any) {
		// console.log(`[IntegrationService] Processing event: ${event}`);

		const organizationId =
			payload.organizationId ||
			(payload.incidentId
				? await this.getOrgIdFromIncident(payload.incidentId)
				: null);

		if (!organizationId) {
			// console.warn(
			// 	`[IntegrationService] Could not determine organizationId for event ${event}`,
			// );
			return;
		}

		const configs = await this.getNotificationConfigs({
			organizationId,
			incidentId: payload.incidentId,
		});

		for (const config of configs) {
			const integration = integrationRegistry.get(config.type);
			if (integration?.events.includes(event)) {
				try {
					// console.log(
					// 	`[IntegrationService] Executing integration ${integration.name} for config ${config.id}`,
					// );
					await integration.handler(config.config, event, payload);
				} catch (_error) {
					// console.error(
					// 	`[IntegrationService] Error executing integration ${config.id}`,
					// 	error,
					// );
				}
			}
		}
	}

	private async getOrgIdFromIncident(
		incidentId: string,
	): Promise<string | null> {
		const inc = await db.query.incident.findFirst({
			where: (t, { eq }) => eq(t.id, incidentId),
			columns: { organizationId: true },
		});
		return inc?.organizationId || null;
	}

	private async getNotificationConfigs(input: {
		organizationId: string;
		incidentId?: string;
	}) {
		if (!input.incidentId) {
			return db.query.integrationConfig.findMany({
				where: (t, { eq, and }) =>
					and(
						eq(t.organizationId, input.organizationId),
						eq(t.active, true),
						eq(t.isDefault, true),
					),
			});
		}

		const incidentMonitors = await db
			.select({ monitorId: incidentMonitor.monitorId })
			.from(incidentMonitor)
			.where(eq(incidentMonitor.incidentId, input.incidentId));

		if (incidentMonitors.length === 0) {
			return db.query.integrationConfig.findMany({
				where: (t, { eq, and }) =>
					and(
						eq(t.organizationId, input.organizationId),
						eq(t.active, true),
						eq(t.isDefault, true),
					),
			});
		}

		const monitorIds = incidentMonitors.map((item) => item.monitorId);
		const assignedConfigs = await db
			.select({ config: integrationConfig })
			.from(integrationConfig)
			.innerJoin(
				monitorNotification,
				eq(monitorNotification.integrationConfigId, integrationConfig.id),
			)
			.where(
				and(
					eq(integrationConfig.organizationId, input.organizationId),
					eq(integrationConfig.active, true),
					inArray(monitorNotification.monitorId, monitorIds),
				),
			);

		return dedupeNotificationConfigs(
			assignedConfigs.map(({ config }) => config),
		);
	}
}

export const integrationService = new IntegrationService();
