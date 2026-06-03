export interface MonitorEventInsert {
	id: string;
	monitorId: string;
	status: string;
	latency: number;
	timestamp: Date;
	statusCode?: number | null;
	error?: string | null;
	location?: string | null;
	dnsLookup?: number | null;
	tcpConnect?: number | null;
	tlsHandshake?: number | null;
	ttfb?: number | null;
	transfer?: number | null;
}

export interface MonitorChangeInsert {
	id: string;
	monitorId: string;
	status: string;
	timestamp: Date;
	location?: string | null;
}

export interface LatestEvent {
	monitorId: string;
	status: string;
	timestamp: Date;
}

export interface LatestChange {
	monitorId: string;
	timestamp: Date;
}

export interface SingleLatestEvent {
	status: string;
	timestamp: Date;
}

export interface SingleLatestChange {
	timestamp: Date;
}

export interface WorkerStatus {
	location: string;
	status: string;
	timestamp: Date;
}

export interface MonitorWorkerStatus extends WorkerStatus {
	monitorId: string;
}

export interface ChangeTimelineItem {
	id: string;
	status: string;
	timestamp: Date;
	location: string | null;
}

export interface ResponseTimePoint {
	timestamp: Date;
	location: string | null;
	status: string | null;
	latency: number;
	dnsLookup: number | null;
	tcpConnect: number | null;
	tlsHandshake: number | null;
	ttfb: number | null;
	transfer: number | null;
}

export interface SparklinePoint {
	monitorId: string;
	latency: number;
	timestamp: Date;
}

export interface HourlyUptimeStat {
	dateHour: string;
	totalChecks: number;
	upChecks: number;
	avgLatency: number;
}

export interface ResponseTimesQuery {
	monitorId: string;
	since: Date;
	locations?: string[];
	limit?: number | null;
	bucketSeconds?: number;
	bucketQuantile?: number;
	groupByLocation?: boolean;
}

export interface ChangeTimelineQuery {
	monitorId: string;
	limit: number;
	cursorBefore?: Date;
}
