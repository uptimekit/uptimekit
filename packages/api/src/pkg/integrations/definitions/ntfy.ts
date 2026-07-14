import { db } from "@uptimekit/db";
import { createLogger } from "../../../lib/logger";
import { assertSafePublicHttpUrl } from "../../../lib/safe-url";
import { fetchIntegrationWebhook } from "../http";
import type { IntegrationDefinition } from "../registry";
import { type NtfyConfig, ntfyIntegrationMeta } from "./ntfy-meta";

interface NtfyMessage {
    title: string;
    message: string;
    click?: string;
}

interface IncidentPayload {
    incidentId: string;
    title?: string;
    description?: string | null;
    message?: string;
    severity?: string;
    sourceIncidentIds?: string[];
}

interface SslPayload {
    monitorId: string;
    monitorName: string;
    domain: string;
    issuer?: string;
    validTo?: string;
    daysUntilExpiry: number;
    isValid: boolean;
    error?: string;
    threshold: number;
}

const logger = createLogger("NTFY");
const PRIORITIES = {
    min: 1,
    low: 2,
    default: 3,
    high: 4,
    max: 5,
} as const;

function getBaseUrl() {
    return process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
}

function getTags(tags?: string) {
    if (!tags) {
        return undefined;
    }

    const values = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

    return values.length > 0 ? values : undefined;
}

function buildTestMessage(payload: unknown): NtfyMessage {
    const description =
        typeof payload === "object" &&
        payload !== null &&
        "description" in payload &&
        typeof payload.description === "string"
            ? payload.description
            : "No details provided";

    return {
        title: "UptimeKit integration test",
        message: [
            "Your ntfy integration is working correctly.",
            "",
            description,
            "",
            `Sent at ${new Date().toLocaleString()}`,
        ].join("\n"),
    };
}

function buildSslMessage(payload: SslPayload): NtfyMessage {
    const title = payload.isValid
        ? "SSL certificate expiring"
        : "SSL certificate problem";
    const details =
        payload.error ||
        `Certificate expires in ${payload.daysUntilExpiry} day${payload.daysUntilExpiry === 1 ? "" : "s"}.`;

    return {
        title: `${title}: ${payload.domain}`,
        message: [
            `Monitor: ${payload.monitorName}`,
            `Domain: ${payload.domain}`,
            `Issuer: ${payload.issuer || "Unknown"}`,
            `Valid until: ${payload.validTo || "Unknown"}`,
            `Threshold: ${payload.threshold} days`,
            "",
            details,
        ].join("\n"),
        click: `${getBaseUrl()}/monitors/${payload.monitorId}`,
    };
}

function getIncidentCopy(event: string, payload: IncidentPayload) {
    switch (event) {
        case "incident.created":
            return {
                title: "New incident created",
                detail: payload.description || "No details provided",
            };
        case "incident.updated":
            return {
                title: "Incident updated",
                detail: payload.description || "No details provided",
            };
        case "incident.resolved":
            return {
                title: "Incident resolved",
                detail:
                    payload.description || "The incident has been resolved.",
            };
        case "incident.acknowledged":
            return {
                title: "Incident acknowledged",
                detail:
                    payload.description ||
                    "The incident has been acknowledged.",
            };
        case "incident.comment_added":
            return {
                title: "New incident comment",
                detail: payload.message || "No content",
            };
        case "incident.merged":
            return {
                title: "Incidents merged",
                detail:
                    payload.description ||
                    `${payload.sourceIncidentIds?.length || 0} incident(s) merged.`,
            };
        case "incident.deleted":
            return {
                title: "Incident deleted",
                detail: "The incident was deleted.",
            };
        default:
            return {
                title: `Event: ${event}`,
                detail: JSON.stringify(payload, null, 2),
            };
    }
}

async function buildIncidentMessage(
    event: string,
    payload: IncidentPayload,
): Promise<NtfyMessage | null> {
    const incidentData = await db.query.incident.findFirst({
        where: (table, { eq }) => eq(table.id, payload.incidentId),
        with: {
            monitors: {
                with: {
                    monitor: true,
                },
            },
        },
    });

    if (!incidentData && event !== "incident.deleted") {
        return null;
    }

    const incidentTitle = payload.title || incidentData?.title || "Incident";
    const monitorNames =
        incidentData?.monitors.map((item) => item.monitor.name).join(", ") ||
        "No monitors";
    const copy = getIncidentCopy(event, payload);

    return {
        title: `${copy.title}: ${incidentTitle}`,
        message: [
            `Severity: ${payload.severity || "Unknown"}`,
            `Monitors: ${monitorNames}`,
            "",
            copy.detail,
        ].join("\n"),
        click:
            event === "incident.deleted"
                ? undefined
                : `${getBaseUrl()}/incidents/${payload.incidentId}`,
    };
}

async function publishMessage(config: NtfyConfig, content: NtfyMessage) {
    const serverUrl = config.serverUrl.replace(/\/+$/, "");
    await assertSafePublicHttpUrl(serverUrl, { label: "ntfy server URL" });

    await fetchIntegrationWebhook(serverUrl, {
        method: "POST",
        redirect: "error",
        headers: {
            "Content-Type": "application/json",
            ...(config.accessToken
                ? { Authorization: `Bearer ${config.accessToken}` }
                : {}),
        },
        body: JSON.stringify({
            topic: config.topic,
            title: content.title,
            message: content.message,
            priority: PRIORITIES[config.priority],
            tags: getTags(config.tags),
            click: content.click,
        }),
    });
}

export const ntfyIntegration: IntegrationDefinition<NtfyConfig> = {
    ...ntfyIntegrationMeta,
    handler: async (config, event, payload) => {
        try {
            const content =
                event === "integration.test"
                    ? buildTestMessage(payload)
                    : event === "monitor.ssl.expiring"
                      ? buildSslMessage(payload as SslPayload)
                      : await buildIncidentMessage(
                            event,
                            payload as IncidentPayload,
                        );

            if (!content) {
                return;
            }

            await publishMessage(config, content);
        } catch (error) {
            logger.error(
                `Failed to send ntfy notification to ${config.topic}`,
                error,
            );
            throw error;
        }
    },
};
