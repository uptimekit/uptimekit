import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	json,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { monitor } from "./monitors";

export const integrationConfig = pgTable(
	"integration_config",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		type: text("type").notNull(), // e.g., 'webhook', 'slack', 'discord'
		config: json("config").$type<Record<string, any>>().notNull(), // Stores the specific config (url, secret, etc.)
		active: boolean("active").default(true).notNull(),
		isDefault: boolean("is_default").default(false).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("integration_config_org_idx").on(table.organizationId),
		index("integration_config_type_idx").on(table.type),
	],
);

export const monitorNotification = pgTable(
	"monitor_notification",
	{
		monitorId: text("monitor_id")
			.notNull()
			.references(() => monitor.id, { onDelete: "cascade" }),
		integrationConfigId: text("integration_config_id")
			.notNull()
			.references(() => integrationConfig.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.monitorId, table.integrationConfigId] }),
		index("monitor_notification_monitor_idx").on(table.monitorId),
		index("monitor_notification_config_idx").on(table.integrationConfigId),
	],
);

export const integrationConfigRelations = relations(
	integrationConfig,
	({ one, many }) => ({
		organization: one(organization, {
			fields: [integrationConfig.organizationId],
			references: [organization.id],
		}),
		monitorNotifications: many(monitorNotification),
	}),
);

export const monitorNotificationRelations = relations(
	monitorNotification,
	({ one }) => ({
		monitor: one(monitor, {
			fields: [monitorNotification.monitorId],
			references: [monitor.id],
		}),
		integrationConfig: one(integrationConfig, {
			fields: [monitorNotification.integrationConfigId],
			references: [integrationConfig.id],
		}),
	}),
);
