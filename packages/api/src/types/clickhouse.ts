// TypeScript interfaces for ClickHouse query results

export interface MonitorEvent {
	id: string;
	monitorId: string;
	status: string;
	latency: number;
	timestamp: string;
	statusCode?: number;
	error?: string;
	location?: string;
}

export interface MonitorChange {
	id: string;
	monitorId: string;
	status: string;
	timestamp: string;
	location?: string;
}

export interface LatestEventResult {
	monitorId: string;
	status: string;
	timestamp: string;
}

export interface LatestChangeResult {
	monitorId: string;
	status: string;
	timestamp: string;
}

export interface EventTimelineResult {
	timestamp: string;
	latency: number;
}

export interface ChangeHistoryResult {
	id: string;
	status: string;
	timestamp: string;
	location?: string;
}

export interface StatsChangeResult {
	status: string;
	timestamp: string;
}

export interface UptimeStatsResult {
	totalEvents: number;
	upEvents: number;
}

export interface AvgPingResult {
	avgPing: number;
}

export interface SingleEventResult {
	status: string;
	timestamp: string;
}

export interface SingleChangeResult {
	timestamp: string;
}

export interface StatusBeforeResult {
	status: string;
}
