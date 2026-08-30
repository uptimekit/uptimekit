import { z } from "zod";
import type { IntegrationDefinition } from "../registry";

export const GchatConfigSchema = z.object({
    webhookUrl: z
        .string()
        .url()
        .refine(
            (url) => url.startsWith("https://chat.googleapis.com/v1/spaces/"),
            {
                message: "Must be a valid Google Chat Webhook URL",
            },
        ),
    message: z.string().optional(),
});

export const gchatIntegrationMeta: Omit<
    IntegrationDefinition<z.infer<typeof GchatConfigSchema>>,
    "handler"
> = {
    id: "gchat",
    name: "Google Chat",
    type: "export",
    logo: "/integrations/gchat.png",
    description: "Get notified in your Google Chat space when incidents occur.",
    configSchema: GchatConfigSchema,
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
