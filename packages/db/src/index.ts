import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Create connection pool - pg Pool doesn't connect until first query
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	connectionTimeoutMillis: 10000,
	max: 20,
	idleTimeoutMillis: 30000,
});

// Handle connection errors gracefully
pool.on("error", (err) => {
	console.error("Unexpected database pool error:", err);
});

export const db = drizzle(pool, { schema });

export * from "./clickhouse";
export * from "./schema";
