import { db } from "@uptimekit/db";
import type { z } from "zod";
import { createLogger } from "../../../lib/logger";
import { fetchIntegrationWebhook } from "../http";
import type { IntegrationDefinition } from "../registry";
import { type GchatConfigSchema, gchatIntegrationMeta } from "./gchat-meta";

const logger = createLogger("GCHAT");

interface GchatWidget {
    decoratedText?: {
        topLabel?: string;
        text: string;
        wrapText?: boolean;
    };
    buttonList?: {
        buttons: Array<{
            text: string;
            onClick: { openLink: { url: string } };
        }>;
    };
}

interface GchatCardMessage {
    text?: string;
    cardsV2?: Array<{
        cardId: string;
        card: {
            header?: { title: string; subtitle?: string };
            sections: Array<{ widgets: GchatWidget[] }>;
        };
    }>;
}

function decoratedText(
    topLabel: string,
    text: string,
    wrapText = false,
): GchatWidget {
    return { decoratedText: { topLabel, text, wrapText } };
}

function linkButton(text: string, url: string): GchatWidget {
    return {
        buttonList: { buttons: [{ text, onClick: { openLink: { url } } }] },
    };
}

async function sendGchatMessage(webhookUrl: string, message: GchatCardMessage) {
    await fetchIntegrationWebhook(webhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify(message),
    });
}

function withCustomMessage(
    customMessage: string | undefined,
    message: GchatCardMessage,
): GchatCardMessage {
    const trimmed = customMessage?.trim();
    return trimmed ? { ...message, text: trimmed } : message;
}

export const gchatIntegration: IntegrationDefinition<
    z.infer<typeof GchatConfigSchema>
> = {
    ...gchatIntegrationMeta,
    handler: async (config, event, payload: any) => {
        try {
            // Handle test event separately (no DB lookup needed)
            if (event === "integration.test") {
                const message = withCustomMessage(config.message, {
                    cardsV2: [
                        {
                            cardId: "uptimekit-test",
                            card: {
                                header: {
                                    title: "✅ Integration Test",
                                    subtitle:
                                        "Your Google Chat integration is working correctly!",
                                },
                                sections: [
                                    {
                                        widgets: [
                                            decoratedText(
                                                "Message",
                                                payload.description ||
                                                    "No details provided",
                                                true,
                                            ),
                                        ],
                                    },
                                ],
                            },
                        },
                    ],
                });

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

                const message = withCustomMessage(config.message, {
                    cardsV2: [
                        {
                            cardId: `uptimekit-ssl-${sslPayload.monitorId}`,
                            card: {
                                header: {
                                    title: sslPayload.isValid
                                        ? "🔒 SSL Certificate Expiring"
                                        : "⚠️ SSL Certificate Problem",
                                    subtitle: sslPayload.domain,
                                },
                                sections: [
                                    {
                                        widgets: [
                                            decoratedText(
                                                "Monitor",
                                                sslPayload.monitorName,
                                            ),
                                            decoratedText(
                                                "Issuer",
                                                sslPayload.issuer || "Unknown",
                                            ),
                                            decoratedText(
                                                "Valid until",
                                                sslPayload.validTo || "Unknown",
                                            ),
                                            decoratedText(
                                                "Threshold",
                                                `${sslPayload.threshold} days`,
                                            ),
                                            decoratedText(
                                                "Details",
                                                details,
                                                true,
                                            ),
                                            linkButton(
                                                "View Monitor",
                                                monitorUrl,
                                            ),
                                        ],
                                    },
                                ],
                            },
                        },
                    ],
                });

                await sendGchatMessage(config.webhookUrl, message);
                return;
            }

            // The incident no longer exists, so skip the DB lookup and any
            // link back to it.
            if (event === "incident.deleted") {
                const message = withCustomMessage(config.message, {
                    cardsV2: [
                        {
                            cardId: `uptimekit-${payload.incidentId}`,
                            card: {
                                header: {
                                    title: "🗑️ Incident Deleted",
                                    subtitle: payload.title,
                                },
                                sections: [
                                    {
                                        widgets: [
                                            decoratedText(
                                                "Details",
                                                "This incident and its history have been removed.",
                                                true,
                                            ),
                                            decoratedText(
                                                "Incident ID",
                                                payload.incidentId,
                                            ),
                                        ],
                                    },
                                ],
                            },
                        },
                    ],
                });

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
                incidentData?.monitors.map((m) => m.monitor.name).join(", ") ||
                "No monitors";

            const incidentUrl = `${baseUrl}/incidents/${payload.incidentId}`;

            let title = "";
            let detailsLabel = "Description";
            let detailsContent = "";

            switch (event) {
                case "incident.created":
                    title = "🔴 Incident Created";
                    detailsContent =
                        payload.description || "No details provided";
                    break;
                case "incident.updated":
                    title = "📝 Incident Updated";
                    detailsContent =
                        payload.description ||
                        "The incident details have been updated.";
                    break;
                case "incident.resolved":
                    title = "🟢 Incident Resolved";
                    detailsContent =
                        payload.description ||
                        "The incident has been resolved.";
                    break;
                case "incident.acknowledged":
                    title = "🟡 Incident Acknowledged";
                    detailsContent =
                        payload.description ||
                        "The incident has been acknowledged.";
                    break;
                case "incident.comment_added":
                    title = "💬 New Comment";
                    detailsLabel = "Comment";
                    detailsContent = payload.message || "No content";
                    break;
                case "incident.merged": {
                    const mergedPayload = payload as {
                        sourceIncidentIds: string[];
                    };
                    title = "🔀 Incident Merged";
                    detailsLabel = "Details";
                    detailsContent = `${mergedPayload.sourceIncidentIds?.length ?? 0} incident(s) were merged into this one.`;
                    break;
                }
                default:
                    title = `Event: ${event}`;
                    detailsLabel = "Payload";
                    detailsContent = JSON.stringify(payload, null, 2);
            }

            const message = withCustomMessage(config.message, {
                cardsV2: [
                    {
                        cardId: `uptimekit-${payload.incidentId}`,
                        card: {
                            header: {
                                title,
                                subtitle: payload.title,
                            },
                            sections: [
                                {
                                    widgets: [
                                        decoratedText(
                                            "Severity",
                                            String(
                                                payload.severity || "unknown",
                                            ).toUpperCase(),
                                        ),
                                        decoratedText(
                                            "Monitors",
                                            monitorNames,
                                            true,
                                        ),
                                        decoratedText(
                                            detailsLabel,
                                            detailsContent,
                                            true,
                                        ),
                                        decoratedText(
                                            "Incident ID",
                                            payload.incidentId,
                                        ),
                                        linkButton(
                                            "Manage Incident",
                                            incidentUrl,
                                        ),
                                    ],
                                },
                            ],
                        },
                    },
                ],
            });

            await sendGchatMessage(config.webhookUrl, message);
        } catch (error) {
            logger.error(
                `Failed to deliver Google Chat notification for event ${event}`,
                error,
            );
            throw error;
        }
    },
};
