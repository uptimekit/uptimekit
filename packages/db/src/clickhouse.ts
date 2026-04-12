import { type ClickHouseClient, createClient } from "@clickhouse/client";

let _clickhouse: ClickHouseClient | null = null;
let _clickhouseInit: Promise<void> | null = null;

const CLICKHOUSE_BOOTSTRAP_QUERIES = [
	"CREATE DATABASE IF NOT EXISTS uptimekit",
	`
		CREATE TABLE IF NOT EXISTS uptimekit.monitor_events (
			id UUID,
			monitorId String,
			status String,
			latency UInt32,
			timestamp DateTime64(3),
			statusCode Nullable(UInt16),
			error Nullable(String),
			location Nullable(String),
			dnsLookup Nullable(UInt32),
			tcpConnect Nullable(UInt32),
			tlsHandshake Nullable(UInt32),
			ttfb Nullable(UInt32),
			transfer Nullable(UInt32)
		) ENGINE = MergeTree()
		ORDER BY (monitorId, timestamp)
	`,
	`
		CREATE TABLE IF NOT EXISTS uptimekit.monitor_changes (
			id UUID,
			monitorId String,
			status String,
			timestamp DateTime64(3),
			location Nullable(String)
		) ENGINE = MergeTree()
		ORDER BY (monitorId, timestamp)
	`,
	`
	-- The main culprit (Every query you run)
	ALTER TABLE system.query_log MODIFY TTL event_date + INTERVAL 3 DAY;

	-- Thread-level details (Very high volume)
	ALTER TABLE system.query_thread_log MODIFY TTL event_date + INTERVAL 3 DAY;

	-- Sampling of query execution (Can get huge)
	ALTER TABLE system.trace_log MODIFY TTL event_date + INTERVAL 3 DAY;

	-- Async metrics (Snapshots of system state)
	ALTER TABLE system.asynchronous_metric_log MODIFY TTL event_date + INTERVAL 3 DAY;

	-- Periodic metrics
	ALTER TABLE system.metric_log MODIFY TTL event_date + INTERVAL 3 DAY;

	-- Error history
	ALTER TABLE system.error_log MODIFY TTL event_date + INTERVAL 3 DAY;

	-- Part mutations history
	ALTER TABLE system.part_log MODIFY TTL event_date + INTERVAL 3 DAY;
	`,
] as const;

function getClickHouse(): ClickHouseClient {
	if (!_clickhouse) {
		_clickhouse = createClient({
			url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
			username: process.env.CLICKHOUSE_USER || "default",
			password: process.env.CLICKHOUSE_PASSWORD || "",
			// Add connection timeout and retry settings
			request_timeout: 30000,
			max_open_connections: 10,
		});
	}
	return _clickhouse;
}

async function ensureClickHouseSchema() {
	if (!_clickhouseInit) {
		_clickhouseInit = (async () => {
			const client = getClickHouse();

			for (const query of CLICKHOUSE_BOOTSTRAP_QUERIES) {
				await client.command({ query });
			}
		})().catch((error) => {
			_clickhouseInit = null;
			throw error;
		});
	}

	await _clickhouseInit;
}

const METHODS_REQUIRING_SCHEMA = new Set<keyof ClickHouseClient>([
	"query",
	"command",
	"insert",
	"exec",
]);

export const clickhouse = new Proxy({} as ClickHouseClient, {
	get(_target, prop) {
		const client = getClickHouse();
		const value = Reflect.get(client, prop);

		if (
			typeof prop === "string" &&
			METHODS_REQUIRING_SCHEMA.has(prop as keyof ClickHouseClient) &&
			typeof value === "function"
		) {
			return async (...args: unknown[]) => {
				await ensureClickHouseSchema();
				return Reflect.apply(value, client, args);
			};
		}

		return value;
	},
	apply(_target, thisArg, args) {
		return Reflect.apply(getClickHouse() as any, thisArg, args);
	},
});
