import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { monitor } from "./monitors";
import { statusPage } from "./status-pages";

// PUBLIC Status Page Reports (formerly "Incidents" for public)
export const statusPageReport = pgTable(
	"status_page_report",
	{
		id: text("id").primaryKey(),
		statusPageId: text("status_page_id")
			.notNull()
			.references(() => statusPage.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		status: text("status").notNull(), // 'investigating', 'identified', 'monitoring', 'resolved'
		severity: text("severity").default("major").notNull(), // 'minor', 'major', 'critical', 'maintenance'
		createdAt: timestamp("created_at").defaultNow().notNull(),
		resolvedAt: timestamp("resolved_at"),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("status_page_report_pageId_idx").on(table.statusPageId),
		index("status_page_report_status_idx").on(table.status),
	],
);

export const statusPageReportUpdate = pgTable(
	"status_page_report_update",
	{
		id: text("id").primaryKey(),
		reportId: text("report_id")
			.notNull()
			.references(() => statusPageReport.id, { onDelete: "cascade" }),
		message: text("message").notNull(),
		status: text("status").notNull(), // Status at the time of update
		createdAt: timestamp("created_at").defaultNow().notNull(),
		userId: text("user_id") // Optional: show who posted the update publically? Usually internal record.
			.references(() => user.id),
	},
	(table) => [
		index("status_page_report_update_reportId_idx").on(table.reportId),
	],
);

// Which monitors are affected by this public report?
export const statusPageReportMonitor = pgTable(
	"status_page_report_monitor",
	{
		reportId: text("report_id")
			.notNull()
			.references(() => statusPageReport.id, { onDelete: "cascade" }),
		monitorId: text("monitor_id")
			.notNull()
			.references(() => monitor.id, { onDelete: "cascade" }),
		status: text("status"), // Optional override: force 'down' on this monitor for this report context
	},
	(table) => [
		index("status_page_report_monitor_reportId_idx").on(table.reportId),
		index("status_page_report_monitor_monitorId_idx").on(table.monitorId),
	],
);

export const statusPageReportRelations = relations(
	statusPageReport,
	({ one, many }) => ({
		statusPage: one(statusPage, {
			fields: [statusPageReport.statusPageId],
			references: [statusPage.id],
		}),
		updates: many(statusPageReportUpdate),
		affectedMonitors: many(statusPageReportMonitor),
	}),
);

export const statusPageReportUpdateRelations = relations(
	statusPageReportUpdate,
	({ one }) => ({
		report: one(statusPageReport, {
			fields: [statusPageReportUpdate.reportId],
			references: [statusPageReport.id],
		}),
		user: one(user, {
			fields: [statusPageReportUpdate.userId],
			references: [user.id],
		}),
	}),
);

export const statusPageReportMonitorRelations = relations(
	statusPageReportMonitor,
	({ one }) => ({
		report: one(statusPageReport, {
			fields: [statusPageReportMonitor.reportId],
			references: [statusPageReport.id],
		}),
		monitor: one(monitor, {
			fields: [statusPageReportMonitor.monitorId],
			references: [monitor.id],
		}),
	}),
);
