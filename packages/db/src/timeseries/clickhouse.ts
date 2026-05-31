import { type ClickHouseClient, createClient } from "@clickhouse/client";
import type { TimeSeriesBackend, TimeSeriesDriver } from "./driver";
import type {
	ChangeTimelineItem,
	ChangeTimelineQuery,
	HourlyUptimeStat,
	LatestChange,
	LatestEvent,
	MonitorChangeInsert,
	MonitorEventInsert,
	MonitorWorkerStatus,
	ResponseTimePoint,
	ResponseTimesQuery,
	SingleLatestChange,
	SingleLatestEvent,
	SparklinePoint,
	WorkerStatus,
} from "./types";

interface BootstrapQuery {
	query: string;
	optionalTable?: {
		database: string;
		table: string;
	};
}

const BOOTSTRAP_QUERIES: BootstrapQuery[] = [
	{ query: "CREATE DATABASE IF NOT EXISTS uptimekit" },
	{
		query: `
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
	},
	{
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
	},
	{
		query:
			"ALTER TABLE system.query_log MODIFY TTL event_date + INTERVAL 3 DAY",
		optionalTable: { database: "system", table: "query_log" },
	},
	{
		query:
			"ALTER TABLE system.query_thread_log MODIFY TTL event_date + INTERVAL 3 DAY",
		optionalTable: { database: "system", table: "query_thread_log" },
	},
	{
		query:
			"ALTER TABLE system.trace_log MODIFY TTL event_date + INTERVAL 3 DAY",
		optionalTable: { database: "system", table: "trace_log" },
	},
	{
		query:
			"ALTER TABLE system.asynchronous_metric_log MODIFY TTL event_date + INTERVAL 3 DAY",
		optionalTable: { database: "system", table: "asynchronous_metric_log" },
	},
	{
		query:
			"ALTER TABLE system.metric_log MODIFY TTL event_date + INTERVAL 3 DAY",
		optionalTable: { database: "system", table: "metric_log" },
	},
	{
		query:
			"ALTER TABLE system.error_log MODIFY TTL event_date + INTERVAL 3 DAY",
		optionalTable: { database: "system", table: "error_log" },
	},
	{
		query: "ALTER TABLE system.part_log MODIFY TTL event_date + INTERVAL 3 DAY",
		optionalTable: { database: "system", table: "part_log" },
	},
];

// ClickHouse returns DateTime64 as "YYYY-MM-DD HH:MM:SS.SSS" without timezone;
// treat as UTC.
function parseTimestamp(value: string): Date {
	if (value.endsWith("Z") || value.includes("+")) {
		return new Date(value);
	}
	return new Date(`${value.replace(" ", "T")}Z`);
}

export interface ClickHouseDriverOptions {
	url?: string;
	username?: string;
	password?: string;
}

export class ClickHouseDriver implements TimeSeriesDriver {
	backend: TimeSeriesBackend = "clickhouse";

	private options: ClickHouseDriverOptions;
	private client: ClickHouseClient | null = null;
	private schemaInit: Promise<void> | null = null;

	constructor(options: ClickHouseDriverOptions = {}) {
		this.options = options;
	}

	private getClient(): ClickHouseClient {
		if (!this.client) {
			this.client = createClient({
				url:
					this.options.url ??
					process.env.CLICKHOUSE_URL ??
					"http://localhost:8123",
				username:
					this.options.username ?? process.env.CLICKHOUSE_USER ?? "default",
				password:
					this.options.password ?? process.env.CLICKHOUSE_PASSWORD ?? "",
				request_timeout: 30000,
				max_open_connections: 10,
			});
		}
		return this.client;
	}

	private async tableExists(database: string, table: string) {
		const result = await this.getClient().query({
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

	async ensureSchema() {
		if (!this.schemaInit) {
			this.schemaInit = (async () => {
				for (const { query, optionalTable } of BOOTSTRAP_QUERIES) {
					if (optionalTable) {
						try {
							const exists = await this.tableExists(
								optionalTable.database,
								optionalTable.table,
							);
							if (!exists) {
								console.warn(
									`[clickhouse] Skipping optional bootstrap query because the table does not exist: ${query}`,
								);
								continue;
							}
							await this.getClient().command({ query });
						} catch (error) {
							const message =
								error instanceof Error ? error.message : String(error);
							console.warn(
								`[clickhouse] Skipping optional bootstrap query (${message}): ${query}`,
							);
						}
						continue;
					}
					await this.getClient().command({ query });
				}
			})().catch((error) => {
				this.schemaInit = null;
				throw error;
			});
		}
		await this.schemaInit;
	}

	private async queryJson<T>(query: string, params?: Record<string, unknown>) {
		await this.ensureSchema();

		const result = await this.getClient().query({
			query,
			query_params: params,
			format: "JSON",
		});

		const json = (await result.json<T>()) as { data: T[] };

		return json.data;
	}

	async insertMonitorEvents(events: MonitorEventInsert[]) {
		if (events.length === 0) return;

		await this.ensureSchema();

		await this.getClient().insert({
			table: "uptimekit.monitor_events",
			values: events.map((e) => ({
				id: e.id,
				monitorId: e.monitorId,
				status: e.status,
				latency: e.latency,
				timestamp: e.timestamp.getTime(),
				statusCode: e.statusCode ?? null,
				error: e.error ?? null,
				location: e.location ?? null,
				dnsLookup: e.dnsLookup ?? null,
				tcpConnect: e.tcpConnect ?? null,
				tlsHandshake: e.tlsHandshake ?? null,
				ttfb: e.ttfb ?? null,
				transfer: e.transfer ?? null,
			})),
			format: "JSONEachRow",
		});
	}

	async insertMonitorChanges(changes: MonitorChangeInsert[]) {
		if (changes.length === 0) return;

		await this.ensureSchema();

		await this.getClient().insert({
			table: "uptimekit.monitor_changes",
			values: changes.map((c) => ({
				id: c.id,
				monitorId: c.monitorId,
				status: c.status,
				timestamp: c.timestamp.getTime(),
				location: c.location ?? null,
			})),
			format: "JSONEachRow",
		});
	}

	async getLatestEventForMonitor(
		monitorId: string,
	): Promise<SingleLatestEvent | undefined> {
		const rows = await this.queryJson<{ status: string; timestamp: string }>(
			"SELECT status, timestamp FROM uptimekit.monitor_events WHERE monitorId = {monitorId:String} ORDER BY timestamp DESC LIMIT 1",
			{ monitorId },
		);

		const row = rows[0];

		return row
			? { status: row.status, timestamp: parseTimestamp(row.timestamp) }
			: undefined;
	}

	async getLatestChangeForMonitor(
		monitorId: string,
	): Promise<SingleLatestChange | undefined> {
		const rows = await this.queryJson<{ timestamp: string }>(
			"SELECT timestamp FROM uptimekit.monitor_changes WHERE monitorId = {monitorId:String} ORDER BY timestamp DESC LIMIT 1",
			{ monitorId },
		);

		const row = rows[0];

		return row ? { timestamp: parseTimestamp(row.timestamp) } : undefined;
	}

	async getLatestEventsForMonitors(
		monitorIds: string[],
	): Promise<LatestEvent[]> {
		if (monitorIds.length === 0) return [];

		const rows = await this.queryJson<{
			monitorId: string;
			status: string;
			timestamp: string;
		}>(
			`
				SELECT
					monitorId,
					status,
					latestTimestamp AS timestamp
				FROM (
					SELECT
						monitorId,
						argMax(status, timestamp) AS status,
						max(timestamp) AS latestTimestamp
					FROM uptimekit.monitor_events
					WHERE monitorId IN ({ids:Array(String)})
					GROUP BY monitorId
				)
			`,
			{ ids: monitorIds },
		);
		return rows.map((r) => ({
			monitorId: r.monitorId,
			status: r.status,
			timestamp: parseTimestamp(r.timestamp),
		}));
	}

	async getLatestChangesForMonitors(
		monitorIds: string[],
	): Promise<LatestChange[]> {
		if (monitorIds.length === 0) return [];

		const rows = await this.queryJson<{
			monitorId: string;
			timestamp: string;
		}>(
			`
				SELECT monitorId, max(timestamp) AS timestamp
				FROM uptimekit.monitor_changes
				WHERE monitorId IN ({ids:Array(String)})
				GROUP BY monitorId
			`,
			{ ids: monitorIds },
		);
		return rows.map((r) => ({
			monitorId: r.monitorId,
			timestamp: parseTimestamp(r.timestamp),
		}));
	}

	async getAverageLatency(monitorId: string, since: Date) {
		const rows = await this.queryJson<{ value: number | string | null }>(
			`
				SELECT avg(latency) as value
				FROM uptimekit.monitor_events
				WHERE monitorId = {monitorId:String}
					AND timestamp >= toDateTime64({startDate:UInt64} / 1000, 3)
			`,
			{ monitorId, startDate: since.getTime() },
		);

		return Number(rows[0]?.value ?? 0);
	}

	async getChangeTimeline(
		query: ChangeTimelineQuery,
	): Promise<ChangeTimelineItem[]> {
		const params: Record<string, unknown> = {
			monitorId: query.monitorId,
			limit: query.limit,
		};
		if (query.cursorBefore) {
			params.cursor = query.cursorBefore.getTime();
		}

		const cursorClause = query.cursorBefore
			? "AND timestamp < toDateTime64({cursor:UInt64} / 1000, 3)"
			: "";

		const rows = await this.queryJson<{
			id: string;
			status: string;
			timestamp: string;
			location: string | null;
		}>(
			`
				SELECT id, status, timestamp, location
				FROM uptimekit.monitor_changes
				WHERE monitorId = {monitorId:String}
				${cursorClause}
				ORDER BY timestamp DESC
				LIMIT {limit:UInt32}
			`,
			params,
		);

		return rows.map((r) => ({
			id: r.id,
			status: r.status,
			timestamp: parseTimestamp(r.timestamp),
			location: r.location ?? null,
		}));
	}

	async getResponseTimes(
		query: ResponseTimesQuery,
	): Promise<ResponseTimePoint[]> {
		const params: Record<string, unknown> = {
			monitorId: query.monitorId,
			startDate: query.since.getTime(),
		};

		let locationFilter = "";
		if (query.locations && query.locations.length > 0) {
			locationFilter = "AND location IN {locations:Array(String)}";
			params.locations = query.locations;
		}

		params.limit = query.limit ?? 2000;

		const rows = await this.queryJson<{
			timestamp: string;
			location: string | null;
			latency: number | string;
			dnsLookup: number | string | null;
			tcpConnect: number | string | null;
			tlsHandshake: number | string | null;
			ttfb: number | string | null;
			transfer: number | string | null;
		}>(
			`
				SELECT timestamp, location, latency, dnsLookup, tcpConnect, tlsHandshake, ttfb, transfer
				FROM uptimekit.monitor_events
				WHERE monitorId = {monitorId:String}
					AND timestamp >= toDateTime64({startDate:UInt64} / 1000, 3)
					${locationFilter}
				ORDER BY timestamp ASC
				LIMIT {limit:UInt32}
			`,
			params,
		);

		return rows.map((r) => ({
			timestamp: parseTimestamp(r.timestamp),
			location: r.location ?? null,
			latency: Number(r.latency) || 0,
			dnsLookup: r.dnsLookup != null ? Number(r.dnsLookup) : null,
			tcpConnect: r.tcpConnect != null ? Number(r.tcpConnect) : null,
			tlsHandshake: r.tlsHandshake != null ? Number(r.tlsHandshake) : null,
			ttfb: r.ttfb != null ? Number(r.ttfb) : null,
			transfer: r.transfer != null ? Number(r.transfer) : null,
		}));
	}

	async getRecentLatenciesByMonitor(
		monitorIds: string[],
		limitPerMonitor: number,
	): Promise<SparklinePoint[]> {
		if (monitorIds.length === 0) return [];

		const rows = await this.queryJson<{
			monitorId: string;
			latency: number | string;
			timestamp: string;
		}>(
			`
				SELECT monitorId, avg(latency) AS latency, max(timestamp) AS timestamp
				FROM (
					SELECT
						monitorId,
						location,
						latency,
						timestamp,
						ROW_NUMBER() OVER (
							PARTITION BY monitorId, location ORDER BY timestamp DESC
						) as rn
					FROM (
						SELECT monitorId, location, latency, timestamp
						FROM uptimekit.monitor_events
						WHERE monitorId IN ({ids:Array(String)})
						ORDER BY monitorId, location, timestamp DESC
						LIMIT {limit:UInt32} BY monitorId, location
					)
				)
				GROUP BY monitorId, rn
				ORDER BY monitorId, timestamp ASC
			`,
			{ ids: monitorIds, limit: limitPerMonitor },
		);

		return rows.map((r) => ({
			monitorId: r.monitorId,
			latency: Number(r.latency) || 0,
			timestamp: parseTimestamp(r.timestamp),
		}));
	}

	async getLatestStatusPerLocation(monitorId: string): Promise<WorkerStatus[]> {
		const statuses = await this.getLatestStatusPerLocationForMonitors([
			monitorId,
		]);

		return statuses.map(({ location, status, timestamp }) => ({
			location,
			status,
			timestamp,
		}));
	}

	async getLatestStatusPerLocationForMonitors(
		monitorIds: string[],
	): Promise<MonitorWorkerStatus[]> {
		if (monitorIds.length === 0) return [];

		const rows = await this.queryJson<{
			monitorId: string;
			location: string;
			status: string;
			timestamp: string;
		}>(
			`
				SELECT
					monitorId,
					location,
					status,
					latestTimestamp AS timestamp
				FROM (
					SELECT
						monitorId,
						location,
						argMax(status, timestamp) AS status,
						max(timestamp) AS latestTimestamp
					FROM uptimekit.monitor_events
					WHERE monitorId IN ({monitorIds:Array(String)})
						AND location IS NOT NULL
					GROUP BY monitorId, location
				)
			`,
			{ monitorIds },
		);

		return rows.map((r) => ({
			monitorId: r.monitorId,
			location: r.location,
			status: r.status,
			timestamp: parseTimestamp(r.timestamp),
		}));
	}

	async getHourlyUptimeStats(
		monitorId: string,
		since: Date,
	): Promise<HourlyUptimeStat[]> {
		const rows = await this.queryJson<{
			date_hour: string;
			total_checks: number | string;
			up_checks: number | string;
			avg_latency: number | string;
		}>(
			`
				SELECT
					formatDateTime(timestamp, '%Y-%m-%d %H') as date_hour,
					count(*) as total_checks,
					countIf(lower(status) = 'up') as up_checks,
					avg(latency) as avg_latency
				FROM uptimekit.monitor_events
				WHERE monitorId = {monitorId:String}
					AND timestamp >= toDateTime64({startDate:UInt64} / 1000, 3)
				GROUP BY date_hour
				ORDER BY date_hour DESC
			`,
			{ monitorId, startDate: since.getTime() },
		);

		return rows.map((r) => ({
			dateHour: r.date_hour,
			totalChecks: Number(r.total_checks) || 0,
			upChecks: Number(r.up_checks) || 0,
			avgLatency: Number(r.avg_latency) || 0,
		}));
	}

	async deleteAllForMonitor(monitorId: string) {
		await this.ensureSchema();

		await this.getClient().command({
			query: `
				ALTER TABLE uptimekit.monitor_events
				DELETE WHERE monitorId = {monitorId:String}
			`,
			query_params: { monitorId },
		});

		await this.getClient().command({
			query: `
				ALTER TABLE uptimekit.monitor_changes
				DELETE WHERE monitorId = {monitorId:String}
			`,
			query_params: { monitorId },
		});
	}

	async deleteOlderThan(cutoff: Date) {
		await this.ensureSchema();

		await this.getClient().command({
			query: `
				ALTER TABLE uptimekit.monitor_events
				DELETE WHERE timestamp < toDateTime64({cutoff:UInt64} / 1000, 3)
			`,
			query_params: { cutoff: cutoff.getTime() },
		});

		await this.getClient().command({
			query: `
				ALTER TABLE uptimekit.monitor_changes
				DELETE WHERE timestamp < toDateTime64({cutoff:UInt64} / 1000, 3)
			`,
			query_params: { cutoff: cutoff.getTime() },
		});
	}

	async ping() {
		await this.getClient().command({ query: "SELECT 1" });
	}

	async close() {
		if (!this.client) return;

		await this.client.close();

		this.client = null;
		this.schemaInit = null;
	}
}
