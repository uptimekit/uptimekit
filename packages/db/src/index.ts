import { loadEnv } from "@uptimekit/config/env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

loadEnv();

const client = postgres(process.env.DATABASE_URL || "", {
	max: 20,
	idle_timeout: 30,
});

export const db = drizzle(client, { schema });

export * from "./clickhouse";
export * from "./schema";
