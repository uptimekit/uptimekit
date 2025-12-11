import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

// INTERNAL Incidents for team coordination
export const incident = pgTable(
	"incident",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		description: text("description"), // Markdown allowed
		status: text("status").notNull(), // 'investigating', 'identified', 'monitoring', 'resolved'
		severity: text("severity").default("major").notNull(), // 'minor', 'major', 'critical'
		acknowledgedAt: timestamp("acknowledged_at"),
		acknowledgedBy: text("acknowledged_by").references(() => user.id),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
		resolvedAt: timestamp("resolved_at"),
	},
	(table) => [
		index("incident_organization_idx").on(table.organizationId),
		index("incident_status_idx").on(table.status),
	],
);

export const incidentActivity = pgTable(
	"incident_activity",
	{
		id: text("id").primaryKey(),
		incidentId: text("incident_id")
			.notNull()
			.references(() => incident.id, { onDelete: "cascade" }),
		message: text("message").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id),
	},
	(table) => [index("incident_activity_incidentId_idx").on(table.incidentId)],
);

export const incidentRelations = relations(incident, ({ one, many }) => ({
	organization: one(organization, {
		fields: [incident.organizationId],
		references: [organization.id],
	}),
	acknowledgedByUser: one(user, {
		fields: [incident.acknowledgedBy],
		references: [user.id],
	}),
	activities: many(incidentActivity),
}));

export const incidentActivityRelations = relations(
	incidentActivity,
	({ one }) => ({
		incident: one(incident, {
			fields: [incidentActivity.incidentId],
			references: [incident.id],
		}),
		user: one(user, {
			fields: [incidentActivity.userId],
			references: [user.id],
		}),
	}),
);
