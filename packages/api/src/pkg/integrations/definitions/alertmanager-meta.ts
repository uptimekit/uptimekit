import { z } from "zod";
import type { IntegrationDefinition } from "../registry";

export const AlertManagerConfigSchema = z.object({
	bearerToken: z.string().min(1),
	autoResolve: z.boolean().default(true),
	defaultSeverity: z.enum(["minor", "major", "critical"]).default("major"),
	titleTemplate: z.string().default("Alert: {{alertname}}"),
});

export type AlertManagerConfig = z.infer<typeof AlertManagerConfigSchema>;

export const alertManagerIntegrationMeta: Omit<
	IntegrationDefinition<AlertManagerConfig>,
	"handler"
> = {
	id: "alertmanager",
	name: "Prometheus AlertManager",
	type: "import",
	logo: "/integrations/prometheus.png",
	description:
		"Receive alerts from Prometheus AlertManager and automatically create incidents.",
	configSchema: AlertManagerConfigSchema,
	events: [],
};
