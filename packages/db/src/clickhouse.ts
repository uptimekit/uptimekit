import { createClient } from "@clickhouse/client";

export const clickhouse = createClient({
	url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
	username: process.env.CLICKHOUSE_USER || "default",
	password: process.env.CLICKHOUSE_PASSWORD || "",
});

export async function ensureClickHouseTables() {
	await clickhouse.command({
		query: "CREATE DATABASE IF NOT EXISTS uptimekit",
	});

	// Monitor Events Table
	await clickhouse.command({
		query: `
      CREATE TABLE IF NOT EXISTS uptimekit.monitor_events (
        id UUID,
        monitorId String,
        status String,
        latency UInt32,
        timestamp DateTime64(3),
        statusCode Nullable(UInt16),
        error Nullable(String),
        location Nullable(String)
      ) ENGINE = MergeTree()
      ORDER BY (monitorId, timestamp)
    `,
	});

	// Monitor Changes Table
	await clickhouse.command({
		query: `
      CREATE TABLE IF NOT EXISTS uptimekit.monitor_changes (
        id UUID,
        monitorId String,
        status String,
        timestamp DateTime64(3),
        location Nullable(String)
      ) ENGINE = MergeTree()
      ORDER BY (monitorId, timestamp)
    `,
	});
}
