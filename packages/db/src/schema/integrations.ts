import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	json,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";

export const integrationConfig = pgTable(
	"integration_config",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		type: text("type").notNull(), // e.g., 'webhook', 'slack', 'discord'
		config: json("config").$type<Record<string, any>>().notNull(), // Stores the specific config (url, secret, etc.)
		active: boolean("active").default(true).notNull(),
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

export const integrationConfigRelations = relations(
	integrationConfig,
	({ one }) => ({
		organization: one(organization, {
			fields: [integrationConfig.organizationId],
			references: [organization.id],
		}),
	}),
);
