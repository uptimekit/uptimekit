import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	json,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";

export const monitorGroup = pgTable(
	"monitor_group",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("monitor_group_organization_idx").on(table.organizationId)],
);

export const monitor = pgTable(
	"monitor",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		groupId: text("group_id").references(() => monitorGroup.id, { onDelete: "set null" }),
		name: text("name").notNull(),
		type: text("type").notNull(), // 'http', 'tcp', 'ping', 'dns', etc.
		active: boolean("active").default(true).notNull(),
		interval: integer("interval").default(60).notNull(), // in seconds
		timeout: integer("timeout").default(30).notNull(), // in seconds
		incidentPendingDuration: integer("incident_pending_duration").default(0).notNull(), // in seconds (confirmation period)
		incidentRecoveryDuration: integer("incident_recovery_duration").default(0).notNull(), // in seconds (recovery period)
		locations: json("locations").$type<string[]>().notNull(), // array of worker locations
		config: json("config").notNull(), // flexible config: url, method, headers, body, etc.
		successStatuses: json("success_statuses").$type<number[]>(), // e.g. [200, 201]
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("monitor_organization_idx").on(table.organizationId),
		index("monitor_active_idx").on(table.active),
		index("monitor_group_idx").on(table.groupId),
	],
);

export const monitorEvent = pgTable(
	"monitor_event",
	{
		id: text("id").primaryKey(),
		monitorId: text("monitor_id")
			.notNull()
			.references(() => monitor.id, { onDelete: "cascade" }),
		status: text("status").notNull(), // 'up', 'down', 'degraded'
		latency: integer("latency").notNull(), // in ms
		timestamp: timestamp("timestamp").defaultNow().notNull(),
		statusCode: integer("status_code"),
		error: text("error"), // short error summary
		errorDetail: json("error_detail"), // full error object/stack
		responseHeaders: json("response_headers"),
		responseBody: text("response_body"),
		location: text("location"), // which worker reported this
	},
	(table) => [
		index("monitor_event_monitorId_idx").on(table.monitorId),
		index("monitor_event_timestamp_idx").on(table.timestamp),
	],
);

export const monitorRelations = relations(monitor, ({ one, many }) => ({
	organization: one(organization, {
		fields: [monitor.organizationId],
		references: [organization.id],
	}),
	group: one(monitorGroup, {
		fields: [monitor.groupId],
		references: [monitorGroup.id],
	}),
	events: many(monitorEvent),
}));

export const monitorGroupRelations = relations(monitorGroup, ({ one, many }) => ({
	organization: one(organization, {
		fields: [monitorGroup.organizationId],
		references: [organization.id],
	}),
	monitors: many(monitor),
}));

export const monitorEventRelations = relations(monitorEvent, ({ one }) => ({
	monitor: one(monitor, {
		fields: [monitorEvent.monitorId],
		references: [monitor.id],
	}),
}));
