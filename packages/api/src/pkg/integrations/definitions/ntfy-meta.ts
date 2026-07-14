import { z } from "zod";
import type { IntegrationDefinition } from "../registry";

const NtfyServerUrlSchema = z
    .string()
    .trim()
    .url({ message: "ntfy server URL must be valid" })
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
        message: "ntfy server URL must use HTTP or HTTPS",
    });

export const NtfyConfigSchema = z.object({
    serverUrl: NtfyServerUrlSchema.default("https://ntfy.sh"),
    topic: z
        .string()
        .trim()
        .min(1, { message: "ntfy topic is required" })
        .max(64, { message: "ntfy topic must be 64 characters or fewer" })
        .regex(/^[-_A-Za-z0-9]+$/, {
            message:
                "ntfy topic may only contain letters, numbers, underscores, and dashes",
        }),
    accessToken: z.string().trim().optional(),
    priority: z
        .enum(["min", "low", "default", "high", "max"])
        .default("default"),
    tags: z.string().trim().optional(),
});

export type NtfyConfig = z.infer<typeof NtfyConfigSchema>;

export const ntfyIntegrationMeta: Omit<
    IntegrationDefinition<NtfyConfig>,
    "handler"
> = {
    id: "ntfy",
    name: "ntfy",
    type: "export",
    description:
        "Send incident and SSL notifications to an ntfy topic, including self-hosted servers.",
    configSchema: NtfyConfigSchema,
    events: [
        "incident.created",
        "incident.updated",
        "incident.resolved",
        "incident.acknowledged",
        "incident.comment_added",
        "incident.merged",
        "incident.deleted",
        "monitor.ssl.expiring",
        "integration.test",
    ],
};
