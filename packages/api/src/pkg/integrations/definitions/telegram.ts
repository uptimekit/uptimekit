import { db } from "@uptimekit/db";
import type { z } from "zod";
import { createLogger } from "../../../lib/logger";
import { fetchIntegrationWebhook } from "../http";
import type { IntegrationDefinition } from "../registry";
import {
	type TelegramConfigSchema,
	telegramIntegrationMeta,
} from "./telegram-meta";

const logger = createLogger("TELEGRAM");

export const telegramIntegration: IntegrationDefinition<
	z.infer<typeof TelegramConfigSchema>
> = {
	...telegramIntegrationMeta,
	handler: async (config, event, payload: any) => {
		try {
			// Handle test event separately (no DB lookup needed)
			if (event === "integration.test") {
				const message = [
					"✅ <b>Integration Test</b>",
					"",
					"<b>Status:</b> Your Telegram integration is working correctly!",
					"",
					"<b>Message:</b>",
					`<pre>${payload.description || "No details provided"}</pre>`,
					"",
					`<b>Timestamp:</b> ${new Date().toLocaleString()}`,
				].join("\n");

				await fetchIntegrationWebhook(
					`https://api.telegram.org/bot${config.botToken}/sendMessage`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							chat_id: config.chatId,
							text: message,
							parse_mode: "HTML",
						}),
					},
				);
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
				const escapeHtml = (s: string) =>
					s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

				const message = [
					sslPayload.isValid
						? "<b>SSL certificate expiring</b>"
						: "<b>SSL certificate problem</b>",
					"",
					`<b>Monitor:</b> ${escapeHtml(sslPayload.monitorName)}`,
					`<b>Domain:</b> ${escapeHtml(sslPayload.domain)}`,
					`<b>Issuer:</b> ${escapeHtml(sslPayload.issuer || "Unknown")}`,
					`<b>Valid until:</b> ${escapeHtml(sslPayload.validTo || "Unknown")}`,
					`<b>Threshold:</b> ${sslPayload.threshold} days`,
					"",
					"<b>Details:</b>",
					`<pre>${escapeHtml(details)}</pre>`,
					"",
					`<a href="${monitorUrl}">View Monitor</a>`,
				].join("\n");

				await fetchIntegrationWebhook(
					`https://api.telegram.org/bot${config.botToken}/sendMessage`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							chat_id: config.chatId,
							text: message,
							parse_mode: "HTML",
							disable_web_page_preview: true,
						}),
					},
				);
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
				incidentData.monitors
					.map((m) => {
						return m.monitor.name;
					})
					.join(", ") || "No monitors";

			const incidentUrl = `${baseUrl}/incidents/${payload.incidentId}`;

			// Determine Content based on Event
			let statusHeader = "";
			let reasonContent = "";

			switch (event) {
				case "incident.created":
					statusHeader = "⛔ <b>New incident created</b>";
					reasonContent = payload.description || "No details provided";
					break;
				case "incident.resolved":
					statusHeader = "✅ <b>Incident resolved</b>";
					reasonContent =
						payload.description || "The incident has been resolved.";
					break;
				case "incident.acknowledged":
					statusHeader = "👀 <b>Incident acknowledged</b>";
					reasonContent =
						payload.description || "The incident has been acknowledged.";
					break;
				case "incident.comment_added":
					statusHeader = "💬 <b>New comment</b>";
					reasonContent = payload.message || "No content";
					break;
				default:
					statusHeader = `Event: <code>${event}</code>`;
					reasonContent = JSON.stringify(payload, null, 2);
			}

			const message = [
				statusHeader,
				"",
				`<b>Monitors:</b> ${monitorNames}`,
				"<b>Details:</b>",
				`<pre>${reasonContent}</pre>`,
				"",
				`<a href="${incidentUrl}">Manage Incident</a>`,
			].join("\n");

			await fetchIntegrationWebhook(
				`https://api.telegram.org/bot${config.botToken}/sendMessage`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						chat_id: config.chatId,
						text: message,
						parse_mode: "HTML",
						disable_web_page_preview: true,
					}),
				},
			);
		} catch (error) {
			logger.error(`Failed to send message to ${config.chatId}`, error);
			throw error;
		}
	},
};
