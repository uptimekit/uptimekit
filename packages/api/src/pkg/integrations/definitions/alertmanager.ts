import { db } from "@uptimekit/db";
import { incident, incidentActivity } from "@uptimekit/db/schema/incidents";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { eventBus } from "../../../lib/events";
import type { IntegrationDefinition } from "../registry";
import {
	type AlertManagerConfig,
	type AlertManagerConfigSchema,
	type AlertManagerPayload,
	alertManagerIntegrationMeta,
} from "./alertmanager-meta";

export interface AlertManagerWebhookResult {
	created: number;
	resolved: number;
	skipped: number;
}

function mapSeverity(
	alertSeverity: string | undefined,
	defaultSeverity: "minor" | "major" | "critical",
): "minor" | "major" | "critical" {
	switch (alertSeverity?.toLowerCase()) {
		case "critical":
			return "critical";
		case "warning":
			return "major";
		case "info":
			return "minor";
		default:
			return defaultSeverity;
	}
}

function interpolateTemplate(
	template: string,
	labels: Record<string, string>,
): string {
	return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
		const value = labels[key];
		return value !== undefined ? value : match;
	});
}

export async function processAlertManagerWebhook(
	config: AlertManagerConfig,
	organizationId: string,
	payload: AlertManagerPayload,
): Promise<AlertManagerWebhookResult> {
	const result: AlertManagerWebhookResult = {
		created: 0,
		resolved: 0,
		skipped: 0,
	};

	for (const alert of payload.alerts) {
		const externalId = alert.fingerprint;
		const externalSource = "alertmanager";

		const existingIncident = await db.query.incident.findFirst({
			where: and(
				eq(incident.organizationId, organizationId),
				eq(incident.externalSource, externalSource),
				eq(incident.externalId, externalId),
			),
		});

		if (alert.status === "firing") {
			if (existingIncident && !existingIncident.resolvedAt) {
				result.skipped++;
				continue;
			}

			const title = interpolateTemplate(config.titleTemplate, alert.labels);
			const severity = mapSeverity(
				alert.labels.severity,
				config.defaultSeverity,
			);
			const description =
				alert.annotations.description ||
				alert.annotations.summary ||
				`Alert from Prometheus AlertManager: ${alert.labels.alertname}`;

			const incidentId = crypto.randomUUID();
			const now = new Date();

			await db.transaction(async (tx) => {
				await tx.insert(incident).values({
					id: incidentId,
					organizationId,
					title,
					description,
					severity,
					status: "investigating",
					type: "automatic",
					externalId,
					externalSource,
					createdAt: now,
					updatedAt: now,
				});

				await tx.insert(incidentActivity).values({
					id: crypto.randomUUID(),
					incidentId,
					message: `Incident created automatically from Prometheus AlertManager alert: ${alert.labels.alertname}`,
					type: "event",
					createdAt: now,
				});
			});

			eventBus.emit("incident.created", {
				incidentId,
				organizationId,
				title,
				description,
				severity,
			});

			result.created++;
		} else if (alert.status === "resolved" && config.autoResolve) {
			if (!existingIncident) {
				result.skipped++;
				continue;
			}

			if (existingIncident.resolvedAt) {
				result.skipped++;
				continue;
			}

			const now = new Date();

			await db.transaction(async (tx) => {
				await tx
					.update(incident)
					.set({
						status: "resolved",
						resolvedAt: now,
						updatedAt: now,
					})
					.where(eq(incident.id, existingIncident.id));

				await tx.insert(incidentActivity).values({
					id: crypto.randomUUID(),
					incidentId: existingIncident.id,
					message: "Incident automatically resolved by Prometheus AlertManager",
					type: "event",
					createdAt: now,
				});
			});

			eventBus.emit("incident.resolved", {
				incidentId: existingIncident.id,
				organizationId,
				title: existingIncident.title,
				description: existingIncident.description,
				severity: existingIncident.severity as "minor" | "major" | "critical",
			});

			result.resolved++;
		} else {
			result.skipped++;
		}
	}

	return result;
}

export const alertManagerIntegration: IntegrationDefinition<
	z.infer<typeof AlertManagerConfigSchema>
> = {
	...alertManagerIntegrationMeta,
	handler: async () => {
		// Import integrations don't use the event-based handler
		// They process incoming webhooks directly via processAlertManagerWebhook
	},
};
