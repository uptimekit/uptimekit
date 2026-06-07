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

export type TimeSeriesBackend = "clickhouse" | "timescale";

export interface TimeSeriesDriver {
	backend: TimeSeriesBackend;

	ensureSchema(): Promise<void>;

	insertMonitorEvents(events: MonitorEventInsert[]): Promise<void>;
	insertMonitorChanges(changes: MonitorChangeInsert[]): Promise<void>;

	getLatestEventForMonitor(
		monitorId: string,
	): Promise<SingleLatestEvent | undefined>;
	getLatestChangeForMonitor(
		monitorId: string,
	): Promise<SingleLatestChange | undefined>;

	getLatestEventsForMonitors(monitorIds: string[]): Promise<LatestEvent[]>;
	getLatestChangesForMonitors(monitorIds: string[]): Promise<LatestChange[]>;

	getAverageLatency(monitorId: string, since: Date): Promise<number>;

	getChangeTimeline(query: ChangeTimelineQuery): Promise<ChangeTimelineItem[]>;
	getResponseTimes(query: ResponseTimesQuery): Promise<ResponseTimePoint[]>;
	getStatusCodeDistribution(
		query: StatusCodeDistributionQuery,
	): Promise<StatusCodeDistributionPoint[]>;

	getRecentLatenciesByMonitor(
		monitorIds: string[],
		limitPerMonitor: number,
	): Promise<SparklinePoint[]>;

	getLatestStatusPerLocation(monitorId: string): Promise<WorkerStatus[]>;
	getLatestStatusPerLocationForMonitors(
		monitorIds: string[],
	): Promise<MonitorWorkerStatus[]>;

	getHourlyUptimeStats(
		monitorId: string,
		since: Date,
	): Promise<HourlyUptimeStat[]>;

	deleteAllForMonitor(monitorId: string): Promise<void>;
	deleteOlderThan(cutoff: Date): Promise<void>;

	ping(): Promise<void>;
	close(): Promise<void>;
}
