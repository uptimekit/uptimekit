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
import { monitorNotification } from "./integrations";
import { monitorTag } from "./tags";

export const monitorGroup = pgTable(
    "monitor_group",
    {
        id: text("id").primaryKey(),
        organizationId: text("organization_id")
            .notNull()
            .references(() => organization.id, { onDelete: "cascade" }),
        parentId: text("parent_id").references((): any => monitorGroup.id, {
            onDelete: "set null",
        }),
        name: text("name").notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        index("monitor_group_organization_idx").on(table.organizationId),
        index("monitor_group_parent_idx").on(table.parentId),
    ],
);

export const monitor = pgTable(
    "monitor",
    {
        id: text("id").primaryKey(),
        organizationId: text("organization_id")
            .notNull()
            .references(() => organization.id, { onDelete: "cascade" }),
        groupId: text("group_id").references(() => monitorGroup.id, {
            onDelete: "set null",
        }),
        name: text("name").notNull(),
        type: text("type").notNull(), // 'http', 'tcp', 'ping', 'dns', etc.
        active: boolean("active").default(true).notNull(),
        pauseReason: text("pause_reason"),
        interval: integer("interval").default(60).notNull(), // in seconds
        timeout: integer("timeout").default(48).notNull(), // in seconds
        retries: integer("retries").default(2).notNull(),
        retryInterval: integer("retry_interval").default(20).notNull(), // in seconds
        incidentPendingDuration: integer("incident_pending_duration")
            .default(0)
            .notNull(), // in seconds (confirmation period)
        incidentRecoveryDuration: integer("incident_recovery_duration")
            .default(0)
            .notNull(), // in seconds (recovery period)
        publishIncidentToStatusPage: boolean("publish_incident_to_status_page")
            .default(false)
            .notNull(),
        locations: json("locations").$type<string[]>().notNull(), // array of worker locations
        workerIds: json("worker_ids").$type<string[]>().notNull(),
        config: json("config").notNull(), // flexible config: url, method, headers, body, etc.
        successStatuses: json("success_statuses").$type<number[]>(), // e.g. [200, 201]
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        index("monitor_organization_created_idx").on(
            table.organizationId,
            table.createdAt,
            table.id,
        ),
        index("monitor_active_idx").on(table.active),
        index("monitor_group_idx").on(table.groupId),
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
    monitorTags: many(monitorTag),
    monitorNotifications: many(monitorNotification),
}));

export const monitorGroupRelations = relations(
    monitorGroup,
    ({ one, many }) => ({
        organization: one(organization, {
            fields: [monitorGroup.organizationId],
            references: [organization.id],
        }),
        parent: one(monitorGroup, {
            fields: [monitorGroup.parentId],
            references: [monitorGroup.id],
            relationName: "monitorGroupHierarchy",
        }),
        children: many(monitorGroup, {
            relationName: "monitorGroupHierarchy",
        }),
        monitors: many(monitor),
    }),
);
