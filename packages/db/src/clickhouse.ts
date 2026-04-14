import { type ClickHouseClient, createClient } from "@clickhouse/client";

let _clickhouse: ClickHouseClient | null = null;
let _clickhouseInit: Promise<void> | null = null;

type BootstrapQuery = {
	query: string;
	optionalTable?: {
		database: string;
		table: string;
	};
};

const CLICKHOUSE_BOOTSTRAP_QUERIES: BootstrapQuery[] = [
	{ query: "CREATE DATABASE IF NOT EXISTS uptimekit" },
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
].map((query) =>
	typeof query === "string" ? ({ query } satisfies BootstrapQuery) : query,
);

CLICKHOUSE_BOOTSTRAP_QUERIES.push(
	{
		query:
			"ALTER TABLE system.query_log MODIFY TTL event_date + INTERVAL 3 DAY",
		optionalTable: {
			database: "system",
			table: "query_log",
		},
	},
	{
		query:
			"ALTER TABLE system.query_thread_log MODIFY TTL event_date + INTERVAL 3 DAY",
		optionalTable: {
			database: "system",
			table: "query_thread_log",
		},
	},
	{
		query:
			"ALTER TABLE system.trace_log MODIFY TTL event_date + INTERVAL 3 DAY",
		optionalTable: {
			database: "system",
			table: "trace_log",
		},
	},
	{
		query:
			"ALTER TABLE system.asynchronous_metric_log MODIFY TTL event_date + INTERVAL 3 DAY",
		optionalTable: {
			database: "system",
			table: "asynchronous_metric_log",
		},
	},
	{
		query:
			"ALTER TABLE system.metric_log MODIFY TTL event_date + INTERVAL 3 DAY",
		optionalTable: {
			database: "system",
			table: "metric_log",
		},
	},
	{
		query:
			"ALTER TABLE system.error_log MODIFY TTL event_date + INTERVAL 3 DAY",
		optionalTable: {
			database: "system",
			table: "error_log",
		},
	},
	{
		query: "ALTER TABLE system.part_log MODIFY TTL event_date + INTERVAL 3 DAY",
		optionalTable: {
			database: "system",
			table: "part_log",
		},
	},
);

async function tableExists(
	client: ClickHouseClient,
	database: string,
	table: string,
): Promise<boolean> {
	const result = await client.query({
		query: `
			SELECT 1
			FROM system.tables
			WHERE database = {database:String} AND name = {table:String}
			LIMIT 1
		`,
		query_params: { database, table },
		format: "JSON",
	});
	const json = await result.json<{ data?: Array<Record<string, unknown>> }>();
	return (json.data?.length ?? 0) > 0;
}

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

			for (const { query, optionalTable } of CLICKHOUSE_BOOTSTRAP_QUERIES) {
				if (optionalTable) {
					const exists = await tableExists(
						client,
						optionalTable.database,
						optionalTable.table,
					);

					if (!exists) {
						console.warn(
							`[clickhouse] Skipping optional bootstrap query because the table does not exist: ${query}`,
						);
						continue;
					}
				}

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
