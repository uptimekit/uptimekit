import { relations } from "drizzle-orm";
import {
	index,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { monitor } from "./monitors";

export const tag = pgTable(
	"tag",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		color: text("color").notNull().default("#3b82f6"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("tag_organization_idx").on(table.organizationId),
		index("tag_name_idx").on(table.name),
	],
);

export const monitorTag = pgTable(
	"monitor_tag",
	{
		monitorId: text("monitor_id")
			.notNull()
			.references(() => monitor.id, { onDelete: "cascade" }),
		tagId: text("tag_id")
			.notNull()
			.references(() => tag.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.monitorId, table.tagId] }),
		index("monitor_tag_monitor_idx").on(table.monitorId),
		index("monitor_tag_tag_idx").on(table.tagId),
	],
);

export const tagRelations = relations(tag, ({ one, many }) => ({
	organization: one(organization, {
		fields: [tag.organizationId],
		references: [organization.id],
	}),
	monitorTags: many(monitorTag),
}));

export const monitorTagRelations = relations(monitorTag, ({ one }) => ({
	monitor: one(monitor, {
		fields: [monitorTag.monitorId],
		references: [monitor.id],
	}),
	tag: one(tag, {
		fields: [monitorTag.tagId],
		references: [tag.id],
	}),
}));
