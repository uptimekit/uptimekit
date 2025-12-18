import type { z } from "zod";

export interface IntegrationDefinition<Config = any> {
	id: string;
	name: string;
	type: "export" | "import";
	logo?: string;
	description: string;
	configSchema: z.ZodSchema<Config>;
	events: string[];
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
