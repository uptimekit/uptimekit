import { z } from "zod";
import type { IntegrationDefinition } from "../registry";

export const WebhookConfigSchema = z.object({
    url: z.string().url(),
    secret: z.string().optional(),
});

export const webhookIntegrationMeta: Omit<
    IntegrationDefinition<z.infer<typeof WebhookConfigSchema>>,
    "handler"
> = {
    id: "webhook",
    name: "Webhook",
    type: "export",
    logo: "/integrations/webhook.png",
    description: "Send a JSON payload to a URL when events occur.",
    configSchema: WebhookConfigSchema,
    events: [
        "incident.created",
        "incident.resolved",
        "incident.acknowledged",
        "incident.comment_added",
    ],
};
