import { db } from "@uptimekit/db";
import type { z } from "zod";
import type { IntegrationDefinition } from "../registry";
import {
    type TelegramConfigSchema,
    telegramIntegrationMeta,
} from "./telegram-meta";
import { createLogger } from "../../../lib/logger";

const logger = createLogger("TELEGRAM");

export const telegramIntegration: IntegrationDefinition<
    z.infer<typeof TelegramConfigSchema>
> = {
    ...telegramIntegrationMeta,
    handler: async (config, event, payload: any) => {
        try {
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
                `<b>Details:</b>`,
                `<pre>${reasonContent}</pre>`,
                "",
                `<a href="${incidentUrl}">Manage Incident</a>`,
            ].join("\n");

            await fetch(
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
            logger.error(
                `Failed to send message to ${config.chatId}`,
                error,
            );
        }
    },
};
