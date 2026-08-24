import { db } from "@uptimekit/db";
import type { z } from "zod";
import { createLogger } from "../../../lib/logger";
import { fetchIntegrationWebhook } from "../http";
import type { IntegrationDefinition } from "../registry";
import { type GchatConfigSchema, gchatIntegrationMeta } from "./gchat-meta";

const logger = createLogger("GCHAT");

async function sendGchatMessage(webhookUrl: string, text: string) {
    await fetchIntegrationWebhook(webhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({ text }),
    });
}

export const gchatIntegration: IntegrationDefinition<
    z.infer<typeof GchatConfigSchema>
> = {
    ...gchatIntegrationMeta,
    handler: async (config, event, payload: any) => {
        try {
            // Handle test event separately (no DB lookup needed)
            if (event === "integration.test") {
                const message = [
                    "✅ *Integration Test*",
                    "",
                    "*Status:* Your Google Chat integration is working correctly!",
                    "",
                    "*Message:*",
                    `\`\`\`${payload.description || "No details provided"}\`\`\``,
                    "",
                    `*Timestamp:* ${new Date().toLocaleString()}`,
                ].join("\n");

                await sendGchatMessage(config.webhookUrl, message);
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
                const baseUrl =
                    process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
                const monitorUrl = `${baseUrl}/monitors/${sslPayload.monitorId}`;
                const details =
                    sslPayload.error ||
                    `Certificate expires in ${sslPayload.daysUntilExpiry} day${sslPayload.daysUntilExpiry === 1 ? "" : "s"}.`;

                const message = [
                    sslPayload.isValid
                        ? "*SSL certificate expiring*"
                        : "*SSL certificate problem*",
                    "",
                    `*Monitor:* ${sslPayload.monitorName}`,
                    `*Domain:* ${sslPayload.domain}`,
                    `*Issuer:* ${sslPayload.issuer || "Unknown"}`,
                    `*Valid until:* ${sslPayload.validTo || "Unknown"}`,
                    `*Threshold:* ${sslPayload.threshold} days`,
                    "",
                    "*Details:*",
                    `\`\`\`${details}\`\`\``,
                    "",
                    `<${monitorUrl}|View Monitor>`,
                ].join("\n");

                await sendGchatMessage(config.webhookUrl, message);
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

            const baseUrl =
                process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

            const monitorNames =
                incidentData?.monitors
                    .map((m) => m.monitor.name)
                    .join(", ") || "No monitors";

            const incidentUrl = `${baseUrl}/incidents/${payload.incidentId}`;

            let statusHeader = "";
            let reasonContent = "";

            switch (event) {
                case "incident.created":
                    statusHeader = "⛔ *New incident created*";
                    reasonContent =
                        payload.description || "No details provided";
                    break;
                case "incident.resolved":
                    statusHeader = "✅ *Incident resolved*";
                    reasonContent =
                        payload.description ||
                        "The incident has been resolved.";
                    break;
                case "incident.acknowledged":
                    statusHeader = "👀 *Incident acknowledged*";
                    reasonContent =
                        payload.description ||
                        "The incident has been acknowledged.";
                    break;
                case "incident.comment_added":
                    statusHeader = "💬 *New comment*";
                    reasonContent = payload.message || "No content";
                    break;
                default:
                    statusHeader = `Event: \`${event}\``;
                    reasonContent = JSON.stringify(payload, null, 2);
            }

            const message = [
                statusHeader,
                "",
                `*Monitors:* ${monitorNames}`,
                "*Details:*",
                `\`\`\`${reasonContent}\`\`\``,
                "",
                `<${incidentUrl}|Manage Incident>`,
            ].join("\n");

            await sendGchatMessage(config.webhookUrl, message);
        } catch (error) {
            logger.error(
                `Failed to send message to ${config.webhookUrl}`,
                error,
            );
            throw error;
        }
    },
};
