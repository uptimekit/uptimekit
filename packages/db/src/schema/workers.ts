import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { apikey } from "./auth";

export const worker = pgTable(
	"worker",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		location: text("location").notNull().unique(), // e.g., 'us-west-1'
		apiKeyId: text("api_key_id").references(() => apikey.id), // Reference to better-auth api key
		active: boolean("active").default(true).notNull(),
		lastHeartbeat: timestamp("last_heartbeat"),
		version: text("version"), // worker version
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("worker_location_idx").on(table.location),
		index("worker_active_idx").on(table.active),
	],
);
