import { z } from "zod";
import type { IntegrationDefinition } from "../registry";

export const DiscordConfigSchema = z.object({
	webhookUrl: z
		.string()
		.url()
		.refine(
			(url) =>
				url.startsWith("https://discord.com/api/webhooks/") ||
				url.startsWith("https://canary.discord.com/api/webhooks/") ||
				url.startsWith("https://ptb.discord.com/api/webhooks/"),
			{
				message: "Must be a valid Discord Webhook URL",
			},
		),
});

export const discordIntegrationMeta: Omit<
	IntegrationDefinition<z.infer<typeof DiscordConfigSchema>>,
	"handler"
> = {
	id: "discord",
	name: "Discord",
	type: "export",
	logo: "/integrations/discord.png",
	description: "Get notified in your Discord server when incidents occur.",
	configSchema: DiscordConfigSchema,
	events: [
		"incident.created",
		"incident.resolved",
		"incident.acknowledged",
		"incident.comment_added",
	],
};
