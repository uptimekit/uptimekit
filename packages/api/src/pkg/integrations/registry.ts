import type { z } from "zod";

export interface IntegrationDefinition<Config = any> {
	id: string; // 'webhook', 'slack', etc.
	name: string;
	type: "export" | "import"; // Distinguish between outgoing notifications and incoming data
	logo?: string; // Path to image in public folder, e.g. '/integrations/webhook.png'
	description: string;
	configSchema: z.ZodSchema<Config>;
	events: string[]; // List of events this integration supports/subscribes to
	handler: (config: Config, event: string, payload: any) => Promise<void>;
}

class IntegrationRegistry {
	private integrations = new Map<string, IntegrationDefinition>();

	register(integration: IntegrationDefinition) {
		this.integrations.set(integration.id, integration);
	}

	get(id: string) {
		return this.integrations.get(id);
	}

	list() {
		return Array.from(this.integrations.values());
	}
}

export const integrationRegistry = new IntegrationRegistry();
