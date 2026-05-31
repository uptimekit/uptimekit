import { db } from "@uptimekit/db";
import { incidentMonitor } from "@uptimekit/db/schema/incidents";
import {
	integrationConfig,
	monitorNotification,
} from "@uptimekit/db/schema/integrations";
import { and, eq, inArray } from "drizzle-orm";
import type {
	AppEventName,
	AppEventPayload,
	PersistedAppEvent,
} from "../../lib/events";
import { createLogger } from "../../lib/logger";
import { alertManagerIntegration } from "./definitions/alertmanager";
import { appriseIntegration } from "./definitions/apprise";
import { discordIntegration } from "./definitions/discord";
import { telegramIntegration } from "./definitions/telegram";
import { webhookIntegration } from "./definitions/webhook";
import { integrationRegistry } from "./registry";

// Register built-in integrations
integrationRegistry.register(webhookIntegration);
integrationRegistry.register(discordIntegration);
integrationRegistry.register(telegramIntegration);
integrationRegistry.register(alertManagerIntegration);
integrationRegistry.register(appriseIntegration);

const logger = createLogger("INTEGRATIONS");
const INTEGRATION_TIMEOUT_MS = 15_000;
const integrationServiceKey = Symbol.for("uptimekit.integrationService");
type GlobalServiceRegistry = typeof globalThis &
	Record<symbol, IntegrationService | undefined>;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;

	const timeoutPromise = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(() => {
			reject(new Error(`${label} timed out after ${timeoutMs}ms`));
		}, timeoutMs);
	});

	return Promise.race([promise, timeoutPromise]).finally(() => {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	});
}

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
	async handleAppEvent(event: PersistedAppEvent) {
		await this.handleEvent(event.eventName, event.payload);
	}

	private async handleEvent<K extends AppEventName>(
		event: K,
		payload: AppEventPayload<K>,
	) {
		const incidentId = "incidentId" in payload ? payload.incidentId : undefined;
		const organizationId =
			payload.organizationId ||
			(incidentId ? await this.getOrgIdFromIncident(incidentId) : null);

		if (!organizationId) {
			// console.warn(
			// 	`[IntegrationService] Could not determine organizationId for event ${event}`,
			// );
			return;
		}

		const configs = await this.getNotificationConfigs({
			organizationId,
			incidentId,
			monitorId: "monitorId" in payload ? payload.monitorId : undefined,
		});

		for (const config of configs) {
			const integration = integrationRegistry.get(config.type);
			if (integration?.events.includes(event)) {
				try {
					await withTimeout(
						integration.handler(config.config, event, payload),
						INTEGRATION_TIMEOUT_MS,
						`${integration.name} integration ${config.id}`,
					);
				} catch (error) {
					logger.error(
						`Error executing ${integration.name} integration ${config.id} for ${event}`,
						error,
					);
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
		monitorId?: string;
	}) {
		if (input.monitorId) {
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
						eq(monitorNotification.monitorId, input.monitorId),
					),
				);

			const configs = dedupeNotificationConfigs(
				assignedConfigs.map(({ config }) => config),
			);

			if (configs.length > 0) {
				return configs;
			}

			return db.query.integrationConfig.findMany({
				where: (t, { eq, and }) =>
					and(
						eq(t.organizationId, input.organizationId),
						eq(t.active, true),
						eq(t.isDefault, true),
					),
			});
		}

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

export const integrationService = (() => {
	const globalForService = globalThis as GlobalServiceRegistry;

	if (!globalForService[integrationServiceKey]) {
		globalForService[integrationServiceKey] = new IntegrationService();
	}

	return globalForService[integrationServiceKey];
})();

export async function handleIntegrationEvent(event: PersistedAppEvent) {
	await integrationService.handleAppEvent(event);
}
