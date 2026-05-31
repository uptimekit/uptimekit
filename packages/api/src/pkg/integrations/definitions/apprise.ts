import { db } from "@uptimekit/db";
import type { z } from "zod";
import { createLogger } from "../../../lib/logger";
import { fetchIntegrationWebhook } from "../http";
import type { IntegrationDefinition } from "../registry";
import {
	type AppriseConfigSchema,
	appriseIntegrationMeta,
} from "./apprise-meta";

const logger = createLogger("APPRISE");

export const appriseIntegration: IntegrationDefinition<
	z.infer<typeof AppriseConfigSchema>
> = {
	...appriseIntegrationMeta,
	handler: async (config, event, payload: any) => {
		const appriseUrl = process.env.APPRISE_URL?.replace(/\/$/, "");

		if (!appriseUrl) {
			logger.warn("APPRISE_URL is not set; skipping Apprise notification");
			return;
		}

		try {
			// Handle test event separately (no DB lookup needed)
			if (event === "integration.test") {
				const body = [
					"Status: Your Apprise integration is working correctly!",
					"",
					"Message:",
					payload.description || "No details provided",
					"",
					`Timestamp: ${new Date().toLocaleString()}`,
				].join("\n");

				await fetchIntegrationWebhook(`${appriseUrl}/notify`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						urls: config.notifyUrl,
						title: "✅ Integration Test",
						body,
						format: "text",
					}),
				});
				return;
			}

			if (event === "monitor.ssl.expiring") {
				const sslPayload = payload as {
					monitorId: string;
					monitorName: string;
					domain: string;
					issuer?: string;
					validTo?: string;
					daysUntilExpiry: number;
					isValid: boolean;
					error?: string;
					threshold: number;
				};
				const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
				const monitorUrl = `${baseUrl}/monitors/${sslPayload.monitorId}`;
				const details =
					sslPayload.error ||
					`Certificate expires in ${sslPayload.daysUntilExpiry} day${sslPayload.daysUntilExpiry === 1 ? "" : "s"}.`;
				const body = [
					`Monitor: ${sslPayload.monitorName}`,
					`Domain: ${sslPayload.domain}`,
					`Issuer: ${sslPayload.issuer || "Unknown"}`,
					`Valid until: ${sslPayload.validTo || "Unknown"}`,
					`Threshold: ${sslPayload.threshold} days`,
					"",
					"Details:",
					details,
					"",
					`View Monitor: ${monitorUrl}`,
				].join("\n");

				await fetchIntegrationWebhook(`${appriseUrl}/notify`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						urls: config.notifyUrl,
						title: sslPayload.isValid
							? "SSL certificate expiring"
							: "SSL certificate problem",
						body,
						format: "text",
					}),
				});
				return;
			}

			// Fetch full incident data to get monitors
			const incidentData = await db.query.incident.findFirst({
				where: (t, { eq }) => eq(t.id, payload.incidentId),
				with: {
					monitors: {
						with: {
							monitor: true,
						},
					},
				},
			});

			if (!incidentData) {
				return;
			}

			const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

			// Format Monitors Field
			const monitorNames =
				incidentData.monitors.map((m) => m.monitor.name).join(", ") ||
				"No monitors";

			const incidentUrl = `${baseUrl}/incidents/${payload.incidentId}`;

			// Determine Content based on Event
			let statusHeader = "";
			let reasonLabel = "Details:";
			let reasonContent = "";

			switch (event) {
				case "incident.created":
					statusHeader = "⛔ New incident created";
					reasonContent = payload.description || "No details provided";
					break;
				case "incident.resolved":
					statusHeader = "✅ Incident resolved";
					reasonContent =
						payload.description || "The incident has been resolved.";
					break;
				case "incident.acknowledged":
					statusHeader = "👀 Incident acknowledged";
					reasonContent =
						payload.description || "The incident has been acknowledged.";
					break;
				case "incident.comment_added":
					statusHeader = "💬 New comment";
					reasonLabel = "Comment:";
					reasonContent = payload.message || "No content";
					break;
				default:
					statusHeader = `Event: ${event}`;
					reasonContent = JSON.stringify(payload, null, 2);
			}

			const body = [
				`Monitors: ${monitorNames}`,
				"",
				reasonLabel,
				reasonContent,
				"",
				`Manage Incident: ${incidentUrl}`,
			].join("\n");

			await fetchIntegrationWebhook(`${appriseUrl}/notify`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					urls: config.notifyUrl,
					title: statusHeader,
					body,
					format: "text",
				}),
			});
		} catch (error) {
			logger.error(`Failed to send notification via ${appriseUrl}`, error);
			throw error;
		}
	},
};
