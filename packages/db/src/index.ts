import { loadEnv } from "@uptimekit/config/env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { createTimeSeriesDriver } from "./timeseries";

loadEnv();

const client = postgres(process.env.DATABASE_URL || "", {
	max: 20,
	idle_timeout: 30,
});

export const db = drizzle(client, { schema });
export const postgresClient = client;

export const timeseries = createTimeSeriesDriver();

export * from "./schema";
export type { TimeSeriesBackend, TimeSeriesDriver } from "./timeseries";
export {
	ClickHouseDriver,
	createTimeSeriesDriver,
	resolveTimeSeriesBackend,
	TimescaleDriver,
} from "./timeseries";
export type * from "./timeseries/types";
