import { appEventOutbox, db } from "@uptimekit/db";
import { type SQL, sql } from "drizzle-orm";

export const APP_EVENT_CHANNEL = "uptimekit_app_events";

export interface AppEvents {
	"incident.created": {
		incidentId: string;
		organizationId: string;
		title: string;
		description?: string | null;
		severity: "minor" | "major" | "critical";
	};
	"incident.acknowledged": {
		incidentId: string;
		organizationId: string;
		title: string;
		description?: string | null;
		severity: "minor" | "major" | "critical";
		userId?: string | null;
	};
	"incident.resolved": {
		incidentId: string;
		organizationId: string;
		title: string;
		description?: string | null;
		severity: "minor" | "major" | "critical";
	};
	"incident.comment_added": {
		incidentId: string;
		organizationId: string;
		title: string;
		message: string;
		severity: "minor" | "major" | "critical";
		userId?: string | null;
	};
	"incident.merged": {
		incidentId: string;
		organizationId: string;
		title: string;
		description?: string | null;
		severity: "minor" | "major" | "critical";
		sourceIncidentIds: string[];
	};
	"incident.deleted": {
		incidentId: string;
		organizationId: string;
		title: string;
		severity: "minor" | "major" | "critical";
	};
	"monitor.ssl.expiring": {
		monitorId: string;
		organizationId: string;
		monitorName: string;
		domain: string;
		issuer?: string;
		validFrom?: string;
		validTo?: string;
		daysUntilExpiry: number;
		isValid: boolean;
		error?: string;
		threshold: number;
	};
}

export type AppEventName = keyof AppEvents;
export type AppEventPayload<K extends AppEventName> = AppEvents[K];
export type IntegrationEventName = AppEventName | "integration.test";

export interface PersistedAppEvent<K extends AppEventName = AppEventName> {
	id: string;
	eventName: K;
	organizationId: string;
	payload: AppEvents[K];
	attempts: number;
	createdAt: Date;
	availableAt: Date;
}

type AppEventWriteClient = {
	execute: (query: SQL) => Promise<unknown>;
	insert: (table: typeof appEventOutbox) => {
		values: (value: typeof appEventOutbox.$inferInsert) => Promise<unknown>;
	};
};

interface PublishAppEventOptions {
	id?: string;
	tx?: AppEventWriteClient;
}

export async function publishAppEvent<K extends AppEventName>(
	eventName: K,
	payload: AppEvents[K],
	options: PublishAppEventOptions = {},
) {
	const id = options.id ?? crypto.randomUUID();
	const client = options.tx ?? db;

	await client.insert(appEventOutbox).values({
		id,
		eventName,
		organizationId: payload.organizationId,
		payload: payload as unknown as Record<string, unknown>,
	});

	await client.execute(sql`select pg_notify(${APP_EVENT_CHANNEL}, ${id})`);

	return { id };
}
