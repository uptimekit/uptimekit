import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { monitor } from "./monitors";

export const sslCertificateNotification = pgTable(
	"ssl_certificate_notification",
	{
		id: text("id").primaryKey(),
		monitorId: text("monitor_id")
			.notNull()
			.references(() => monitor.id, { onDelete: "cascade" }),
		domain: text("domain").notNull(),
		lastNotifiedAt: timestamp("last_notified_at").notNull(),
		daysUntilExpiryAtNotification: text(
			"days_until_expiry_at_notification",
		).notNull(), // Store as text to handle decimals
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("ssl_cert_notification_monitor_idx").on(table.monitorId),
		index("ssl_cert_notification_domain_idx").on(table.domain),
	],
);

export const sslCertificateNotificationRelations = relations(
	sslCertificateNotification,
	({ one }) => ({
		monitor: one(monitor, {
			fields: [sslCertificateNotification.monitorId],
			references: [monitor.id],
		}),
	}),
);
