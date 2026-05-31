import {
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";

export const appEventOutbox = pgTable(
	"app_event_outbox",
	{
		id: text("id").primaryKey(),
		eventName: text("event_name").notNull(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
		status: text("status").default("pending").notNull(),
		attempts: integer("attempts").default(0).notNull(),
		availableAt: timestamp("available_at").defaultNow().notNull(),
		lockedAt: timestamp("locked_at"),
		lockedBy: text("locked_by"),
		processedAt: timestamp("processed_at"),
		lastError: text("last_error"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("app_event_outbox_ready_idx").on(table.status, table.availableAt),
		index("app_event_outbox_locked_idx").on(table.status, table.lockedAt),
		index("app_event_outbox_organization_idx").on(table.organizationId),
		index("app_event_outbox_created_idx").on(table.createdAt),
	],
);
