import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const worker = pgTable(
	"worker",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		location: text("location").notNull().unique(), // e.g., 'us-west-1'
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

export const workerApiKey = pgTable(
	"worker_api_key",
	{
		id: text("id").primaryKey(),
		keyHash: text("key_hash").notNull().unique(), // SHA-256 hash of the key
		keyHint: text("key_hint").notNull(), // First 8 chars for display (e.g., "uk_abc12...")
		workerId: text("worker_id")
			.notNull()
			.references(() => worker.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		lastUsedAt: timestamp("last_used_at"),
	},
	(table) => [
		index("worker_api_key_hash_idx").on(table.keyHash),
		index("worker_api_key_worker_id_idx").on(table.workerId),
	],
);

// Relations
export const workerRelations = relations(worker, ({ many }) => ({
	apiKeys: many(workerApiKey),
}));

export const workerApiKeyRelations = relations(workerApiKey, ({ one }) => ({
	worker: one(worker, {
		fields: [workerApiKey.workerId],
		references: [worker.id],
	}),
}));
