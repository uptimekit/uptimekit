import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const CONFIG_DEFAULTS: Record<string, string> = {
	instance_name: "UptimeKit",
	data_retention_days: "30",
	registration_enabled: "false",
};

export const configuration = pgTable("configuration", {
	id: text("id").primaryKey(),
	key: text("key").notNull().unique(),
	value: text("value").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});
