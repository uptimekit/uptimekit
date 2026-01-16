import { db } from "@uptimekit/db";
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

		// Fetch active integrations for this org
		const configs = await db.query.integrationConfig.findMany({
			where: (t, { eq, and }) =>
				and(eq(t.organizationId, organizationId), eq(t.active, true)),
		});

		for (const config of configs) {
			const integration = integrationRegistry.get(config.type);
			if (integration && integration.events.includes(event)) {
				try {
					// console.log(
					// 	`[IntegrationService] Executing integration ${integration.name} for config ${config.id}`,
					// );
					await integration.handler(config.config, event, payload);
				} catch (error) {
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
}

export const integrationService = new IntegrationService();
