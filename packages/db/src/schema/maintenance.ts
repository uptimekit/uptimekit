import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { monitor } from "./monitors";
import { statusPage } from "./status-pages";

export const maintenance = pgTable(
	"maintenance",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		description: text("description"),
		startAt: timestamp("start_at").notNull(),
		endAt: timestamp("end_at").notNull(),
		status: text("status").notNull(), // 'scheduled', 'in_progress', 'completed'
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("maintenance_organizationId_idx").on(table.organizationId),
		index("maintenance_status_idx").on(table.status),
		index("maintenance_startAt_idx").on(table.startAt),
		index("maintenance_endAt_idx").on(table.endAt),
	],
);

export const maintenanceMonitor = pgTable(
	"maintenance_monitor",
	{
		maintenanceId: text("maintenance_id")
			.notNull()
			.references(() => maintenance.id, { onDelete: "cascade" }),
		monitorId: text("monitor_id")
			.notNull()
			.references(() => monitor.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("maintenance_monitor_maintenanceId_idx").on(table.maintenanceId),
		index("maintenance_monitor_monitorId_idx").on(table.monitorId),
	],
);

export const maintenanceStatusPage = pgTable(
	"maintenance_status_page",
	{
		maintenanceId: text("maintenance_id")
			.notNull()
			.references(() => maintenance.id, { onDelete: "cascade" }),
		statusPageId: text("status_page_id")
			.notNull()
			.references(() => statusPage.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("maintenance_status_page_maintenanceId_idx").on(table.maintenanceId),
		index("maintenance_status_page_statusPageId_idx").on(table.statusPageId),
	],
);

export const maintenanceRelations = relations(maintenance, ({ one, many }) => ({
	organization: one(organization, {
		fields: [maintenance.organizationId],
		references: [organization.id],
	}),
	monitors: many(maintenanceMonitor),
	statusPages: many(maintenanceStatusPage),
}));

export const maintenanceMonitorRelations = relations(
	maintenanceMonitor,
	({ one }) => ({
		maintenance: one(maintenance, {
			fields: [maintenanceMonitor.maintenanceId],
			references: [maintenance.id],
		}),
		monitor: one(monitor, {
			fields: [maintenanceMonitor.monitorId],
			references: [monitor.id],
		}),
	}),
);

export const maintenanceStatusPageRelations = relations(
	maintenanceStatusPage,
	({ one }) => ({
		maintenance: one(maintenance, {
			fields: [maintenanceStatusPage.maintenanceId],
			references: [maintenance.id],
		}),
		statusPage: one(statusPage, {
			fields: [maintenanceStatusPage.statusPageId],
			references: [statusPage.id],
		}),
	}),
);
