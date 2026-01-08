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
import { monitor } from "./monitors";

export const statusPage = pgTable(
	"status_page",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		slug: text("slug").notNull().unique(), // e.g. 'acme' -> acme.uptimekit.com (or /s/acme)
		domain: text("domain").unique(), // Custom domain
		description: text("description"),
		public: boolean("public").default(true).notNull(),
		password: text("password"), // If private
		design: json("design"), // Theme, logo, colors, custom CSS
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("status_page_organization_idx").on(table.organizationId),
		index("status_page_slug_idx").on(table.slug),
		index("status_page_domain_idx").on(table.domain),
	],
);

export const statusPageGroup = pgTable(
	"status_page_group",
	{
		id: text("id").primaryKey(),
		statusPageId: text("status_page_id")
			.notNull()
			.references(() => statusPage.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		order: integer("order").default(0).notNull(),
	},
	(table) => [index("status_page_group_pageId_idx").on(table.statusPageId)],
);

export const statusPageMonitor = pgTable(
	"status_page_monitor",
	{
		statusPageId: text("status_page_id")
			.notNull()
			.references(() => statusPage.id, { onDelete: "cascade" }),
		monitorId: text("monitor_id")
			.notNull()
			.references(() => monitor.id, { onDelete: "cascade" }),
		groupId: text("group_id").references(() => statusPageGroup.id, {
			onDelete: "set null",
		}),
		style: text("style").default("history").notNull(), // 'history' | 'status'
		description: text("description"), // Optional description shown in info tooltip
		order: integer("order").default(0).notNull(),
	},
	(table) => [
		index("status_page_monitor_pageId_idx").on(table.statusPageId),
		index("status_page_monitor_monitorId_idx").on(table.monitorId),
	],
);

export const statusPageRelations = relations(statusPage, ({ one, many }) => ({
	organization: one(organization, {
		fields: [statusPage.organizationId],
		references: [organization.id],
	}),
	monitors: many(statusPageMonitor),
	groups: many(statusPageGroup),
}));

export const statusPageGroupRelations = relations(
	statusPageGroup,
	({ one, many }) => ({
		statusPage: one(statusPage, {
			fields: [statusPageGroup.statusPageId],
			references: [statusPage.id],
		}),
		monitors: many(statusPageMonitor),
	}),
);

export const statusPageMonitorRelations = relations(
	statusPageMonitor,
	({ one }) => ({
		statusPage: one(statusPage, {
			fields: [statusPageMonitor.statusPageId],
			references: [statusPage.id],
		}),
		monitor: one(monitor, {
			fields: [statusPageMonitor.monitorId],
			references: [monitor.id],
		}),
		group: one(statusPageGroup, {
			fields: [statusPageMonitor.groupId],
			references: [statusPageGroup.id],
		}),
	}),
);
