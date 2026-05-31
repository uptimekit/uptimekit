import { z } from "zod";
import type { IntegrationDefinition } from "../registry";

export const AppriseConfigSchema = z.object({
	notifyUrl: z.string().min(1),
});

export const appriseIntegrationMeta: Omit<
	IntegrationDefinition<z.infer<typeof AppriseConfigSchema>>,
	"handler"
> = {
	id: "apprise",
	name: "Apprise",
	type: "export",
	logo: "/integrations/apprise.png",
	description:
		"Fan out incident events to any of Apprise's 70+ supported services (Slack, Discord, Matrix, email, SMS, push, and more). Requires the bundled apprise service to be reachable via APPRISE_URL.",
	configSchema: AppriseConfigSchema,
	events: [
		"incident.created",
		"incident.resolved",
		"incident.acknowledged",
		"incident.comment_added",
		"monitor.ssl.expiring",
		"integration.test",
	],
};
