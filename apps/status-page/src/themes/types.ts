import type { IncidentHistoryPeriod } from "@/lib/incident-history";

// Status Type Definition
export type StatusType =
	| "operational"
	| "degraded"
	| "partial_outage"
	| "major_outage"
	| "maintenance"
	| "maintenance_scheduled"
	| "maintenance_completed"
	| "unknown";

// Uptime Day Definition
export interface UptimeDay {
	date: string;
	status: StatusType;
	uptime: number;
	downtimeMs?: number;
	annotation?: string;
	duration?: string;
}

export interface StatusPageDesign {
	themeId?: string;
	theme?: "light" | "dark";
	logoUrl?: string;
	faviconUrl?: string;
	websiteUrl?: string;
	contactUrl?: string;
	customCss?: string;
	headerLayout?: "vertical" | "horizontal";
	barStyle?: "normal" | "length" | "signal";
	barDays?: 30 | 60 | 90;
}

export interface MonitorGroup {
	id: string;
	name: string;
	order: number;
}

export interface Monitor {
	id: string;
	name: string;
	currentStatus: StatusType;
	avgUptime: number;
	history: UptimeDay[];
	displayStyle: "history" | "status";
	description?: string | null;
	group?: MonitorGroup | null;
}

export interface GroupedMonitors {
	group: MonitorGroup | null;
	monitors: Monitor[];
}

export interface IncidentActivity {
	id: string;
	message: string;
	createdAt: Date;
	type: string;
}

export interface IncidentMonitor {
	monitor: {
		id: string;
		name: string;
	};
}

export interface Incident {
	id: string;
	title: string;
	status: string;
	severity: string;
	startedAt: Date;
	endedAt: Date | null;
	monitors: IncidentMonitor[];
	activities: IncidentActivity[];
	detailsLink: string;
}

export interface MaintenanceMonitor {
	monitorId: string;
	monitor: {
		id: string;
		name: string;
	};
}

export interface Maintenance {
	id: string;
	title: string;
	description: string | null;
	status: string;
	startAt: Date;
	endAt: Date | null;
	createdAt: Date;
	monitors: MaintenanceMonitor[];
	detailsLink: string;
}

export interface StatusPageConfig {
	id: string;
	name: string;
	slug: string;
	design: StatusPageDesign;
}

export interface StatusPageData {
	config: StatusPageConfig;
	overallStatus: StatusType;
	monitorGroups: GroupedMonitors[];
	activeIssues: Incident[];
	scheduledMaintenances: Maintenance[];
	pastIncidents: Record<string, Incident[]>;
	lastUpdated: string;
}

export interface ThemePageProps {
	data: StatusPageData;
}

export interface IncidentDetailData {
	config: StatusPageConfig;
	incident: Incident;
	activeIssues: Incident[];
}

export interface MaintenanceDetailData {
	config: StatusPageConfig;
	maintenance: Maintenance;
	activeIssues: Incident[];
}

export interface UpdatesPageData {
	config: StatusPageConfig;
	allUpdates: Incident[];
	incidentsByDate: Record<string, Incident[]>;
	activeIssues: Incident[];
	selectedPeriod: IncidentHistoryPeriod;
}

export interface ThemeIncidentDetailProps {
	data: IncidentDetailData;
}

export interface ThemeMaintenanceDetailProps {
	data: MaintenanceDetailData;
}

export interface ThemeUpdatesProps {
	data: UpdatesPageData;
}

export interface ThemeManifest {
	id: string;
	name: string;
	description: string;
	version: string;
	supportsDarkMode: boolean;
	previewImage?: string;
	configSchema?: Record<string, unknown>;
}
