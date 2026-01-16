import { z } from "zod";
import type { IntegrationDefinition } from "../registry";

export const AlertManagerConfigSchema = z.object({
	bearerToken: z.string().min(1),
	autoResolve: z.boolean().default(true),
	defaultSeverity: z.enum(["minor", "major", "critical"]).default("major"),
	titleTemplate: z.string().default("Alert: {{alertname}}"),
});

export type AlertManagerConfig = z.infer<typeof AlertManagerConfigSchema>;

const AlertManagerAlertSchema = z.object({
	status: z.enum(["firing", "resolved"]),
	labels: z.record(z.string(), z.string()),
	annotations: z.record(z.string(), z.string()),
	startsAt: z.string(),
	endsAt: z.string(),
	fingerprint: z.string(),
});

export const AlertManagerPayloadSchema = z.object({
	version: z.string(),
	status: z.enum(["firing", "resolved"]),
	alerts: z.array(AlertManagerAlertSchema),
});

export type AlertManagerPayload = z.infer<typeof AlertManagerPayloadSchema>;

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
