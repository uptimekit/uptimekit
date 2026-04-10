import type * as z from "zod";
import { assertSafeWebhookUrl } from "../../../lib/safe-url";
import type { IntegrationDefinition } from "../registry";
import { WebhookConfigSchema } from "./webhook-meta";

export const webhookIntegration: IntegrationDefinition<
	z.infer<typeof WebhookConfigSchema>
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
		"integration.test",
	],
	handler: async (config, event, payload) => {
		// console.log(`[Webhook] Sending ${event} to ${config.url}`);
		try {
			await assertSafeWebhookUrl(config.url);
			await fetch(config.url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(config.secret ? { "X-Webhook-Secret": config.secret } : {}),
				},
				body: JSON.stringify({
					event,
					payload,
					timestamp: new Date().toISOString(),
				}),
			});
		} catch (_error) {
			// console.error(`[Webhook] Failed to send webhook to ${config.url}`, error);
		}
	},
};
