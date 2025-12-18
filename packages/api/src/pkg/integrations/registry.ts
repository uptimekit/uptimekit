import type { z } from "zod";

export interface IntegrationDefinition<Config = unknown> {
	id: string;
	name: string;
	type: "export" | "import";
	logo?: string;
	description: string;
	configSchema: z.ZodSchema<Config>;
	events: string[];
	handler: (config: Config, event: string, payload: unknown) => Promise<void>;
}

class IntegrationRegistry {
	private integrations = new Map<string, IntegrationDefinition<any>>();

	register(integration: IntegrationDefinition<any>) {
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
