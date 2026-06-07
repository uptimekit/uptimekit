import postgres from "postgres";
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
	StatusCodeDistributionPoint,
	StatusCodeDistributionQuery,
	WorkerStatus,
} from "./types";

export interface TimescaleDriverOptions {
	url?: string;
	client?: ReturnType<typeof postgres>;
	autoCreateExtension?: boolean;
}

function formatDateHour(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
		date.getUTCDate(),
	)} ${pad(date.getUTCHours())}`;
}

export class TimescaleDriver implements TimeSeriesDriver {
	backend: TimeSeriesBackend = "timescale";

	private options: TimescaleDriverOptions;
	private autoCreateExtension: boolean;
	private ownedClient: ReturnType<typeof postgres> | null = null;
	private schemaInit: Promise<void> | null = null;

	constructor(options: TimescaleDriverOptions = {}) {
		this.options = options;
		this.autoCreateExtension = options.autoCreateExtension ?? true;
	}

	private getClient(): ReturnType<typeof postgres> {
		if (this.options.client) return this.options.client;
		if (!this.ownedClient) {
			const url =
				this.options.url ??
				process.env.TIMESCALE_DATABASE_URL ??
				process.env.DATABASE_URL ??
				"";
			if (!url) {
				throw new Error(
					"TimescaleDB driver requires TIMESCALE_DATABASE_URL or DATABASE_URL",
				);
			}
			this.ownedClient = postgres(url, {
				max: 20,
				idle_timeout: 30,
			});
		}
		return this.ownedClient;
	}

	async ensureSchema() {
		if (!this.schemaInit) {
			this.schemaInit = (async () => {
				const sql = this.getClient();
				if (this.autoCreateExtension) {
					try {
						await sql.unsafe("CREATE EXTENSION IF NOT EXISTS timescaledb");
					} catch (error) {
						throw new Error(
							`Failed to create timescaledb extension. Ensure your PostgreSQL image has the TimescaleDB extension installed (e.g. use 'timescale/timescaledb:2.27.1-pg18'). Original error: ${
								error instanceof Error ? error.message : String(error)
							}`,
						);
					}
				}

				await sql.unsafe(`
					CREATE TABLE IF NOT EXISTS monitor_events (
						id UUID NOT NULL,
						monitor_id TEXT NOT NULL,
						status TEXT NOT NULL,
						latency INTEGER NOT NULL,
						timestamp TIMESTAMPTZ NOT NULL,
						status_code SMALLINT,
						error TEXT,
						location TEXT,
						dns_lookup INTEGER,
						tcp_connect INTEGER,
						tls_handshake INTEGER,
						ttfb INTEGER,
						transfer INTEGER
					)
				`);

				await sql.unsafe(
					"SELECT create_hypertable('monitor_events', 'timestamp', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE)",
				);

				await sql.unsafe(
					"CREATE INDEX IF NOT EXISTS monitor_events_monitor_time_idx ON monitor_events (monitor_id, timestamp DESC)",
				);

				await sql.unsafe(
					"CREATE INDEX IF NOT EXISTS monitor_events_monitor_location_time_idx ON monitor_events (monitor_id, location, timestamp DESC)",
				);

				await sql.unsafe(`
					CREATE TABLE IF NOT EXISTS monitor_changes (
						id UUID NOT NULL,
						monitor_id TEXT NOT NULL,
						status TEXT NOT NULL,
						timestamp TIMESTAMPTZ NOT NULL,
						location TEXT
					)
				`);

				await sql.unsafe(
					"SELECT create_hypertable('monitor_changes', 'timestamp', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE)",
				);

				await sql.unsafe(
					"CREATE INDEX IF NOT EXISTS monitor_changes_monitor_time_idx ON monitor_changes (monitor_id, timestamp DESC)",
				);
			})().catch((error) => {
				this.schemaInit = null;
				throw error;
			});
		}
		await this.schemaInit;
	}

	async insertMonitorEvents(events: MonitorEventInsert[]) {
		if (events.length === 0) return;

		await this.ensureSchema();

		const sql = this.getClient();
		const rows = events.map((e) => ({
			id: e.id,
			monitor_id: e.monitorId,
			status: e.status,
			latency: e.latency,
			timestamp: e.timestamp,
			status_code: e.statusCode ?? null,
			error: e.error ?? null,
			location: e.location ?? null,
			dns_lookup: e.dnsLookup ?? null,
			tcp_connect: e.tcpConnect ?? null,
			tls_handshake: e.tlsHandshake ?? null,
			ttfb: e.ttfb ?? null,
			transfer: e.transfer ?? null,
		}));

		await sql`INSERT INTO monitor_events ${sql(rows)}`;
	}

	async insertMonitorChanges(changes: MonitorChangeInsert[]) {
		if (changes.length === 0) return;

		await this.ensureSchema();

		const sql = this.getClient();
		const rows = changes.map((c) => ({
			id: c.id,
			monitor_id: c.monitorId,
			status: c.status,
			timestamp: c.timestamp,
			location: c.location ?? null,
		}));

		await sql`INSERT INTO monitor_changes ${sql(rows)}`;
	}

	async getLatestEventForMonitor(
		monitorId: string,
	): Promise<SingleLatestEvent | undefined> {
		await this.ensureSchema();

		const sql = this.getClient();
		const rows = await sql<{ status: string; timestamp: Date }[]>`
			SELECT status, timestamp
			FROM monitor_events
			WHERE monitor_id = ${monitorId}
			ORDER BY timestamp DESC
			LIMIT 1
		`;

		const row = rows[0];

		return row ? { status: row.status, timestamp: row.timestamp } : undefined;
	}

	async getLatestChangeForMonitor(
		monitorId: string,
	): Promise<SingleLatestChange | undefined> {
		await this.ensureSchema();

		const sql = this.getClient();
		const rows = await sql<{ timestamp: Date }[]>`
			SELECT timestamp
			FROM monitor_changes
			WHERE monitor_id = ${monitorId}
			ORDER BY timestamp DESC
			LIMIT 1
		`;

		const row = rows[0];

		return row ? { timestamp: row.timestamp } : undefined;
	}

	async getLatestEventsForMonitors(
		monitorIds: string[],
	): Promise<LatestEvent[]> {
		if (monitorIds.length === 0) return [];

		await this.ensureSchema();

		const sql = this.getClient();
		const rows = await sql<
			{ monitor_id: string; status: string; timestamp: Date }[]
		>`
			SELECT DISTINCT ON (monitor_id) monitor_id, status, timestamp
			FROM monitor_events
			WHERE monitor_id = ANY(${monitorIds})
			ORDER BY monitor_id, timestamp DESC
		`;

		return rows.map((r) => ({
			monitorId: r.monitor_id,
			status: r.status,
			timestamp: r.timestamp,
		}));
	}

	async getLatestChangesForMonitors(
		monitorIds: string[],
	): Promise<LatestChange[]> {
		if (monitorIds.length === 0) return [];

		await this.ensureSchema();

		const sql = this.getClient();
		const rows = await sql<{ monitor_id: string; timestamp: Date }[]>`
			SELECT DISTINCT ON (monitor_id) monitor_id, timestamp
			FROM monitor_changes
			WHERE monitor_id = ANY(${monitorIds})
			ORDER BY monitor_id, timestamp DESC
		`;

		return rows.map((r) => ({
			monitorId: r.monitor_id,
			timestamp: r.timestamp,
		}));
	}

	async getAverageLatency(monitorId: string, since: Date) {
		await this.ensureSchema();

		const sql = this.getClient();
		const rows = await sql<{ value: string | number | null }[]>`
			SELECT AVG(latency)::float8 AS value
			FROM monitor_events
			WHERE monitor_id = ${monitorId}
				AND timestamp >= ${since}
		`;

		return Number(rows[0]?.value ?? 0);
	}

	async getChangeTimeline(
		query: ChangeTimelineQuery,
	): Promise<ChangeTimelineItem[]> {
		await this.ensureSchema();

		const sql = this.getClient();
		const rows = query.cursorBefore
			? await sql<
					{
						id: string;
						status: string;
						timestamp: Date;
						location: string | null;
					}[]
				>`
					SELECT id, status, timestamp, location
					FROM monitor_changes
					WHERE monitor_id = ${query.monitorId}
						AND timestamp < ${query.cursorBefore}
					ORDER BY timestamp DESC
					LIMIT ${query.limit}
				`
			: await sql<
					{
						id: string;
						status: string;
						timestamp: Date;
						location: string | null;
					}[]
				>`
					SELECT id, status, timestamp, location
					FROM monitor_changes
					WHERE monitor_id = ${query.monitorId}
					ORDER BY timestamp DESC
					LIMIT ${query.limit}
				`;

		return rows.map((r) => ({
			id: r.id,
			status: r.status,
			timestamp: r.timestamp,
			location: r.location ?? null,
		}));
	}

	async getResponseTimes(
		query: ResponseTimesQuery,
	): Promise<ResponseTimePoint[]> {
		await this.ensureSchema();

		const sql = this.getClient();
		if (query.bucketSeconds !== undefined) {
			const bucketSeconds = query.bucketSeconds;
			const quantile = query.bucketQuantile ?? 0.99;
			const hasLocations = query.locations && query.locations.length > 0;

			if (query.groupByLocation) {
				const rows = hasLocations
					? await sql<
							{
								timestamp: Date;
								location: string | null;
								status: string | null;
								latency: number;
								dns_lookup: number | null;
								tcp_connect: number | null;
								tls_handshake: number | null;
								ttfb: number | null;
								transfer: number | null;
							}[]
						>`
							SELECT
								time_bucket(make_interval(secs => ${bucketSeconds}), timestamp) AS timestamp,
								location,
								CASE
									WHEN BOOL_AND(status = 'down') THEN 'down'
									WHEN BOOL_OR(status IN ('down', 'degraded')) THEN 'degraded'
									WHEN BOOL_OR(status = 'maintenance') THEN 'maintenance'
									ELSE 'up'
								END AS status,
								percentile_cont(${quantile}) WITHIN GROUP (ORDER BY latency) AS latency,
								percentile_cont(${quantile}) WITHIN GROUP (ORDER BY dns_lookup) AS dns_lookup,
								percentile_cont(${quantile}) WITHIN GROUP (ORDER BY tcp_connect) AS tcp_connect,
								percentile_cont(${quantile}) WITHIN GROUP (ORDER BY tls_handshake) AS tls_handshake,
								percentile_cont(${quantile}) WITHIN GROUP (ORDER BY ttfb) AS ttfb,
								percentile_cont(${quantile}) WITHIN GROUP (ORDER BY transfer) AS transfer
							FROM monitor_events
							WHERE monitor_id = ${query.monitorId}
								AND timestamp >= ${query.since}
								AND location = ANY(${query.locations as string[]})
							GROUP BY 1, location
							ORDER BY timestamp ASC, location ASC
						`
					: await sql<
							{
								timestamp: Date;
								location: string | null;
								status: string | null;
								latency: number;
								dns_lookup: number | null;
								tcp_connect: number | null;
								tls_handshake: number | null;
								ttfb: number | null;
								transfer: number | null;
							}[]
						>`
							SELECT
								time_bucket(make_interval(secs => ${bucketSeconds}), timestamp) AS timestamp,
								location,
								CASE
									WHEN BOOL_AND(status = 'down') THEN 'down'
									WHEN BOOL_OR(status IN ('down', 'degraded')) THEN 'degraded'
									WHEN BOOL_OR(status = 'maintenance') THEN 'maintenance'
									ELSE 'up'
								END AS status,
								percentile_cont(${quantile}) WITHIN GROUP (ORDER BY latency) AS latency,
								percentile_cont(${quantile}) WITHIN GROUP (ORDER BY dns_lookup) AS dns_lookup,
								percentile_cont(${quantile}) WITHIN GROUP (ORDER BY tcp_connect) AS tcp_connect,
								percentile_cont(${quantile}) WITHIN GROUP (ORDER BY tls_handshake) AS tls_handshake,
								percentile_cont(${quantile}) WITHIN GROUP (ORDER BY ttfb) AS ttfb,
								percentile_cont(${quantile}) WITHIN GROUP (ORDER BY transfer) AS transfer
							FROM monitor_events
							WHERE monitor_id = ${query.monitorId}
								AND timestamp >= ${query.since}
							GROUP BY 1, location
							ORDER BY timestamp ASC, location ASC
						`;

				return rows.map((r) => ({
					timestamp: r.timestamp,
					location: r.location ?? null,
					status: r.status ?? null,
					latency: Number(r.latency) || 0,
					dnsLookup: r.dns_lookup != null ? Number(r.dns_lookup) : null,
					tcpConnect: r.tcp_connect != null ? Number(r.tcp_connect) : null,
					tlsHandshake:
						r.tls_handshake != null ? Number(r.tls_handshake) : null,
					ttfb: r.ttfb != null ? Number(r.ttfb) : null,
					transfer: r.transfer != null ? Number(r.transfer) : null,
				}));
			}

			const rows = hasLocations
				? await sql<
						{
							timestamp: Date;
							location: string | null;
							status: string | null;
							latency: number;
							dns_lookup: number | null;
							tcp_connect: number | null;
							tls_handshake: number | null;
							ttfb: number | null;
							transfer: number | null;
						}[]
					>`
						SELECT
							time_bucket(make_interval(secs => ${bucketSeconds}), timestamp) AS timestamp,
							NULL::TEXT AS location,
							CASE
								WHEN BOOL_AND(status = 'down') THEN 'down'
								WHEN BOOL_OR(status IN ('down', 'degraded')) THEN 'degraded'
								WHEN BOOL_OR(status = 'maintenance') THEN 'maintenance'
								ELSE 'up'
							END AS status,
							percentile_cont(${quantile}) WITHIN GROUP (ORDER BY latency) AS latency,
							percentile_cont(${quantile}) WITHIN GROUP (ORDER BY dns_lookup) AS dns_lookup,
							percentile_cont(${quantile}) WITHIN GROUP (ORDER BY tcp_connect) AS tcp_connect,
							percentile_cont(${quantile}) WITHIN GROUP (ORDER BY tls_handshake) AS tls_handshake,
							percentile_cont(${quantile}) WITHIN GROUP (ORDER BY ttfb) AS ttfb,
							percentile_cont(${quantile}) WITHIN GROUP (ORDER BY transfer) AS transfer
						FROM monitor_events
						WHERE monitor_id = ${query.monitorId}
							AND timestamp >= ${query.since}
							AND location = ANY(${query.locations as string[]})
						GROUP BY 1
						ORDER BY timestamp ASC
					`
				: await sql<
						{
							timestamp: Date;
							location: string | null;
							status: string | null;
							latency: number;
							dns_lookup: number | null;
							tcp_connect: number | null;
							tls_handshake: number | null;
							ttfb: number | null;
							transfer: number | null;
						}[]
					>`
						SELECT
							time_bucket(make_interval(secs => ${bucketSeconds}), timestamp) AS timestamp,
							NULL::TEXT AS location,
							CASE
								WHEN BOOL_AND(status = 'down') THEN 'down'
								WHEN BOOL_OR(status IN ('down', 'degraded')) THEN 'degraded'
								WHEN BOOL_OR(status = 'maintenance') THEN 'maintenance'
								ELSE 'up'
							END AS status,
							percentile_cont(${quantile}) WITHIN GROUP (ORDER BY latency) AS latency,
							percentile_cont(${quantile}) WITHIN GROUP (ORDER BY dns_lookup) AS dns_lookup,
							percentile_cont(${quantile}) WITHIN GROUP (ORDER BY tcp_connect) AS tcp_connect,
							percentile_cont(${quantile}) WITHIN GROUP (ORDER BY tls_handshake) AS tls_handshake,
							percentile_cont(${quantile}) WITHIN GROUP (ORDER BY ttfb) AS ttfb,
							percentile_cont(${quantile}) WITHIN GROUP (ORDER BY transfer) AS transfer
						FROM monitor_events
						WHERE monitor_id = ${query.monitorId}
							AND timestamp >= ${query.since}
						GROUP BY 1
						ORDER BY timestamp ASC
					`;

			return rows.map((r) => ({
				timestamp: r.timestamp,
				location: r.location ?? null,
				status: r.status ?? null,
				latency: Number(r.latency) || 0,
				dnsLookup: r.dns_lookup != null ? Number(r.dns_lookup) : null,
				tcpConnect: r.tcp_connect != null ? Number(r.tcp_connect) : null,
				tlsHandshake: r.tls_handshake != null ? Number(r.tls_handshake) : null,
				ttfb: r.ttfb != null ? Number(r.ttfb) : null,
				transfer: r.transfer != null ? Number(r.transfer) : null,
			}));
		}

		const limit = query.limit === undefined ? 2000 : query.limit;
		const limitClause = limit === null ? sql`` : sql`LIMIT ${limit}`;
		const hasLocations = query.locations && query.locations.length > 0;

		const rows = hasLocations
			? await sql<
					{
						timestamp: Date;
						location: string | null;
						status: string | null;
						latency: number;
						dns_lookup: number | null;
						tcp_connect: number | null;
						tls_handshake: number | null;
						ttfb: number | null;
						transfer: number | null;
					}[]
				>`
					SELECT timestamp, location, status, latency,
						dns_lookup, tcp_connect, tls_handshake, ttfb, transfer
					FROM monitor_events
					WHERE monitor_id = ${query.monitorId}
						AND timestamp >= ${query.since}
						AND location = ANY(${query.locations as string[]})
					ORDER BY timestamp DESC
					${limitClause}
				`
			: await sql<
					{
						timestamp: Date;
						location: string | null;
						status: string | null;
						latency: number;
						dns_lookup: number | null;
						tcp_connect: number | null;
						tls_handshake: number | null;
						ttfb: number | null;
						transfer: number | null;
					}[]
				>`
					SELECT timestamp, location, status, latency,
						dns_lookup, tcp_connect, tls_handshake, ttfb, transfer
					FROM monitor_events
					WHERE monitor_id = ${query.monitorId}
						AND timestamp >= ${query.since}
					ORDER BY timestamp DESC
					${limitClause}
				`;

		// Fetched newest-first so the LIMIT keeps the most recent rows, not the
		// oldest; reverse to return ascending order.
		return rows
			.map((r) => ({
				timestamp: r.timestamp,
				location: r.location ?? null,
				status: r.status ?? null,
				latency: Number(r.latency) || 0,
				dnsLookup: r.dns_lookup != null ? Number(r.dns_lookup) : null,
				tcpConnect: r.tcp_connect != null ? Number(r.tcp_connect) : null,
				tlsHandshake: r.tls_handshake != null ? Number(r.tls_handshake) : null,
				ttfb: r.ttfb != null ? Number(r.ttfb) : null,
				transfer: r.transfer != null ? Number(r.transfer) : null,
			}))
			.reverse();
	}

	async getStatusCodeDistribution(
		query: StatusCodeDistributionQuery,
	): Promise<StatusCodeDistributionPoint[]> {
		await this.ensureSchema();

		const sql = this.getClient();
		const rows = await sql<{ status_code: number; count: number | string }[]>`
			SELECT status_code, COUNT(*) AS count
			FROM monitor_events
			WHERE monitor_id = ${query.monitorId}
				AND timestamp >= ${query.since}
				AND status_code IS NOT NULL
			GROUP BY status_code
			ORDER BY status_code ASC
		`;

		return rows.map((row) => ({
			statusCode: Number(row.status_code),
			count: Number(row.count),
		}));
	}

	async getRecentLatenciesByMonitor(
		monitorIds: string[],
		limitPerMonitor: number,
	): Promise<SparklinePoint[]> {
		if (monitorIds.length === 0) return [];

		await this.ensureSchema();

		const sql = this.getClient();
		const rows = await sql<
			{ monitor_id: string; latency: number; timestamp: Date }[]
		>`
			WITH monitor_locations AS (
				SELECT DISTINCT monitor_id, location
				FROM monitor_events
				WHERE monitor_id = ANY(${monitorIds})
			),
			recent_events AS (
				SELECT
					monitor_locations.monitor_id,
					event.latency,
					event.timestamp,
					ROW_NUMBER() OVER (
						PARTITION BY monitor_locations.monitor_id, monitor_locations.location
						ORDER BY event.timestamp DESC
					) AS rn
				FROM monitor_locations
				CROSS JOIN LATERAL (
					SELECT latency, timestamp
					FROM monitor_events AS monitor_event
					WHERE monitor_event.monitor_id = monitor_locations.monitor_id
						AND monitor_event.location IS NOT DISTINCT FROM monitor_locations.location
					ORDER BY monitor_event.timestamp DESC
					LIMIT ${limitPerMonitor}
				) event
			)
			SELECT monitor_id, AVG(latency) AS latency, MAX(timestamp) AS timestamp
			FROM recent_events
			GROUP BY monitor_id, rn
			ORDER BY monitor_id, MAX(timestamp) ASC
		`;

		return rows.map((r) => ({
			monitorId: r.monitor_id,
			latency: Number(r.latency) || 0,
			timestamp: r.timestamp,
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

		await this.ensureSchema();

		const sql = this.getClient();
		const rows = await sql<
			{
				monitor_id: string;
				location: string | null;
				status: string;
				timestamp: Date;
			}[]
		>`
			SELECT DISTINCT ON (monitor_id, location)
				monitor_id, location, status, timestamp
			FROM monitor_events
			WHERE monitor_id = ANY(${monitorIds})
				AND location IS NOT NULL
			ORDER BY monitor_id, location, timestamp DESC
		`;

		return rows
			.filter(
				(
					r,
				): r is {
					monitor_id: string;
					location: string;
					status: string;
					timestamp: Date;
				} => r.location != null,
			)
			.map((r) => ({
				monitorId: r.monitor_id,
				location: r.location,
				status: r.status,
				timestamp: r.timestamp,
			}));
	}

	async getHourlyUptimeStats(
		monitorId: string,
		since: Date,
	): Promise<HourlyUptimeStat[]> {
		await this.ensureSchema();

		const sql = this.getClient();
		const rows = await sql<
			{
				hour: Date;
				total_checks: number | string;
				up_checks: number | string;
				avg_latency: number | string | null;
			}[]
		>`
			SELECT
				time_bucket('1 hour', timestamp) AS hour,
				COUNT(*) AS total_checks,
				COUNT(*) FILTER (WHERE lower(status) = 'up') AS up_checks,
				AVG(latency)::float8 AS avg_latency
			FROM monitor_events
			WHERE monitor_id = ${monitorId}
				AND timestamp >= ${since}
			GROUP BY hour
			ORDER BY hour DESC
		`;

		return rows.map((r) => ({
			dateHour: formatDateHour(r.hour),
			totalChecks: Number(r.total_checks) || 0,
			upChecks: Number(r.up_checks) || 0,
			avgLatency: Number(r.avg_latency) || 0,
		}));
	}

	async deleteAllForMonitor(monitorId: string) {
		await this.ensureSchema();

		const sql = this.getClient();

		await sql`DELETE FROM monitor_events WHERE monitor_id = ${monitorId}`;
		await sql`DELETE FROM monitor_changes WHERE monitor_id = ${monitorId}`;
	}

	async deleteOlderThan(cutoff: Date) {
		await this.ensureSchema();

		const sql = this.getClient();

		await sql`DELETE FROM monitor_events WHERE timestamp < ${cutoff}`;
		await sql`DELETE FROM monitor_changes WHERE timestamp < ${cutoff}`;
	}

	async ping() {
		await this.getClient()`SELECT 1`;
	}

	async close() {
		if (!this.ownedClient) return;

		await this.ownedClient.end();

		this.ownedClient = null;
		this.schemaInit = null;
	}
}
