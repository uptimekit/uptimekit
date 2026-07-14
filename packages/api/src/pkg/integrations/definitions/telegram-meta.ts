import { z } from "zod";
import type { IntegrationDefinition } from "../registry";

export const TelegramConfigSchema = z.object({
    botToken: z.string().min(1, { message: "Bot Token is required" }),
    chatId: z.string().min(1, { message: "Chat ID is required" }),
});

export const telegramIntegrationMeta: Omit<
    IntegrationDefinition<z.infer<typeof TelegramConfigSchema>>,
    "handler"
> = {
    id: "telegram",
    name: "Telegram",
    type: "export",
    logo: "/integrations/telegram.png",
    description: "Get notified in your Telegram channel when incidents occur.",
    configSchema: TelegramConfigSchema,
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
