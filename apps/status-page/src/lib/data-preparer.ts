import type { Monitor, MonitorGroup, StatusPageData, StatusType, UptimeDay } from "@/themes/types";

import {
	getActiveMaintenances,
	getActiveStatusPageReports,
	getMaintenanceHistory,
	getMonitorStatus,
	getMonitorUptime,
	getScheduledMaintenances,
	getStatusPageEvents,
	getStatusPageReports,
} from "./db-queries";
import { buildPath } from "./route-utils";
import { calculateAggregateStatus } from "./status-utils";

function calculateDailyStatus(total: number, up: number): StatusType {
	if (total === 0) return "unknown";
	const ratio = up / total;
	if (ratio < 1) return "major_outage";
	return "operational";
}

function fillMissingDays(
	stats: {
		date: string;
		total_checks: number;
		up_checks: number;
	}[],
	days = 90,
	endDate?: string,
	intervalSeconds = 60,
): UptimeDay[] {
	const result: UptimeDay[] = [];
	let now: Date;
	if (endDate) {
		now = new Date(endDate);
	} else {
		const today = new Date();
		now = new Date(
			Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
		);
	}

	const statsMap = new Map(stats.map((s) => [s.date, s]));

	for (let i = days - 1; i >= 0; i--) {
		const d = new Date(now);
		d.setDate(d.getDate() - i);
		const dateStr = d.toISOString().split("T")[0];
		const stat = statsMap.get(dateStr);

		if (stat) {
			const uptime =
				stat.total_checks > 0 ? (stat.up_checks / stat.total_checks) * 100 : 0;
			const failedChecks = stat.total_checks - stat.up_checks;
			const downtimeMs = failedChecks * intervalSeconds * 1000;
			result.push({
				date: dateStr,
				status: calculateDailyStatus(stat.total_checks, stat.up_checks),
				uptime: uptime,
				downtimeMs: downtimeMs,
			});
		} else {
			result.push({
				date: dateStr,
				status: "unknown",
				uptime: 0,
				downtimeMs: 0,
			});
		}
	}
	return result;
}

function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (hours > 0) {
		return `${hours}h ${minutes % 60}m`;
	}
	if (minutes > 0) {
		return `${minutes}m`;
	}
	return `${seconds}s`;
}

export async function prepareStatusPageData(
	pageConfig: any,
	slug?: string,
): Promise<StatusPageData> {
	const [activeReports, activeMaintenances, scheduledMaintenances] =
		await Promise.all([
			getActiveStatusPageReports(pageConfig.id),
			getActiveMaintenances(pageConfig.id),
			getScheduledMaintenances(pageConfig.id),
		]);

	const [reports, maintenances, events] = await Promise.all([
		getStatusPageReports(pageConfig.id),
		getMaintenanceHistory(pageConfig.id),
		getStatusPageEvents(pageConfig.id, 90),
	]);

	const combinedActive = [
		...activeReports.map((r: any) => ({
			id: r.id,
			title: r.title,
			status: r.status,
			severity: r.severity,
			createdAt: r.createdAt,
			resolvedAt: r.resolvedAt,
			monitors: r.affectedMonitors.map((am: any) => ({ monitor: am.monitor })),
			activities: r.updates.map((u: any) => ({
				id: u.id,
				message: u.message,
				createdAt: u.createdAt,
				type: "update",
			})),
			detailsLink: buildPath(`/incidents/${r.id}`, slug),
		})),
		...activeMaintenances.map((m: any) => ({
			id: m.id,
			title: m.title,
			status: m.status,
			severity: "maintenance",
			createdAt: m.createdAt,
			resolvedAt: m.endAt,
			monitors: m.monitors,
			activities: [],
			detailsLink: buildPath(`/maintenance/${m.id}`, slug),
		})),
	].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	const pastIncidents = [
		...reports.map((r) => ({
			id: r.id,
			title: r.title,
			status: r.status,
			severity: r.severity,
			createdAt: r.createdAt,
			resolvedAt: r.resolvedAt,
			monitors: r.affectedMonitors.map((am) => ({ monitor: am.monitor })),
			activities: r.updates.map((u) => ({
				id: u.id,
				message: u.message,
				createdAt: u.createdAt,
				type: "update",
			})),
			detailsLink: buildPath(`/incidents/${r.id}`, slug),
		})),
		...maintenances.map((m) => ({
			id: m.id,
			title: m.title,
			status: m.status,
			severity: "maintenance",
			createdAt: m.createdAt,
			resolvedAt: m.endAt,
			monitors: m.monitors.map((mm) => ({ monitor: mm.monitor })),
			activities: [],
			detailsLink: buildPath(`/maintenance/${m.id}`, slug),
		})),
	].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	const monitorsWithStats = await Promise.all(
		pageConfig.monitors.map(async (pm: any) => {
			const hourlyStats = await getMonitorUptime(pm.monitorId);
			return { pm, hourlyStats };
		}),
	);

	const monitorsData = await Promise.all(
		monitorsWithStats.map(async ({ pm, hourlyStats }) => {
			const dailyStatsMap = new Map<
				string,
				{ date: string; total_checks: number; up_checks: number }
			>();

			for (const stat of hourlyStats) {
				const dateObj = new Date(`${stat.date_hour.replace(" ", "T")}:00:00Z`);

				const year = dateObj.getUTCFullYear();
				const month = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
				const day = String(dateObj.getUTCDate()).padStart(2, "0");
				const localDateStr = `${year}-${month}-${day}`;

				if (!dailyStatsMap.has(localDateStr)) {
					dailyStatsMap.set(localDateStr, {
						date: localDateStr,
						total_checks: 0,
						up_checks: 0,
					});
				}

				const daily = dailyStatsMap.get(localDateStr)!;
				daily.total_checks += Number(stat.total_checks);
				daily.up_checks += Number(stat.up_checks);
			}

			const dailyStats = Array.from(dailyStatsMap.values()).sort((a, b) =>
				b.date.localeCompare(a.date),
			);

			let currentStatus: StatusType = "operational";

			const isUnderMaintenance = activeMaintenances.some((m: any) =>
				m.monitors.some((mm: any) => mm.monitorId === pm.monitorId),
			);
			if (isUnderMaintenance) {
				currentStatus = "maintenance" as any;
			}

			const activeReport = activeReports.find((r: any) =>
				r.affectedMonitors.some((am: any) => am.monitorId === pm.monitorId),
			);

			if (activeReport) {
				switch (activeReport.severity) {
					case "minor":
					case "degraded":
						currentStatus = "degraded";
						break;
					case "major":
						currentStatus = "partial_outage";
						break;
					case "critical":
						currentStatus = "major_outage";
						break;
					default:
						currentStatus = "major_outage";
				}
			}

			if (currentStatus === "operational") {
				const lastCheck = await getMonitorStatus(pm.monitorId);
				if (lastCheck) {
					if (lastCheck.status === "down") currentStatus = "major_outage";
				}
			}

			const monitorInterval = pm.monitor.interval || 60;
			const incidentPendingDuration = pm.monitor.incidentPendingDuration || 0;
			const incidentThresholdMs = incidentPendingDuration * 1000;

			let history = fillMissingDays(dailyStats, 90, undefined, monitorInterval);

			history = history.map((day) => ({
				...day,
				downtimeMs:
					(day.downtimeMs || 0) > incidentThresholdMs ? day.downtimeMs : 0,
			}));

			history = history.map((day) => {
				const dayDate = new Date(day.date);
				dayDate.setHours(12, 0, 0, 0);

				const dayStart = new Date(day.date);
				dayStart.setHours(0, 0, 0, 0);
				const dayEnd = new Date(day.date);
				dayEnd.setHours(23, 59, 59, 999);

				const maintenance = events.maintenances.find((m: any) => {
					const affectsMonitor = m.monitors.some(
						(mm: any) => mm.monitorId === pm.monitorId,
					);
					if (!affectsMonitor) return false;

					const start = new Date(m.startAt);
					const end = m.endAt ? new Date(m.endAt) : new Date();

					return start <= dayEnd && end >= dayStart;
				});

				if (maintenance) {
					return {
						...day,
						status: "maintenance" as any,
						uptime: 100,
						duration: undefined,
					};
				}

				const relevantReports = events.reports.filter((r: any) => {
					const affectsMonitor = r.affectedMonitors.some(
						(am: any) => am.monitorId === pm.monitorId,
					);
					if (!affectsMonitor) return false;

					const start = new Date(r.createdAt);
					const end = r.resolvedAt ? new Date(r.resolvedAt) : new Date();

					return start <= dayEnd && end >= dayStart;
				});

				if (relevantReports.length > 0) {
					let totalDurationMs = 0;

					for (const r of relevantReports) {
						const start = new Date(r.createdAt);
						const end = r.resolvedAt ? new Date(r.resolvedAt) : new Date();

						const overlapStart = start > dayStart ? start : dayStart;
						const overlapEnd = end < dayEnd ? end : dayEnd;

						if (overlapEnd > overlapStart) {
							totalDurationMs += overlapEnd.getTime() - overlapStart.getTime();
						}
					}

					const totalDayMs = 86400000;
					const lossRatio = Math.min(totalDurationMs / totalDayMs, 1);
					const newUptime = (1 - lossRatio) * 100;

					let worstSeverityStatus: StatusType = "operational";

					for (const r of relevantReports) {
						let currentStatusForReport: StatusType = "operational";
						if (r.severity === "critical")
							currentStatusForReport = "major_outage";
						else if (r.severity === "major")
							currentStatusForReport = "partial_outage";
						else if (r.severity === "minor" || r.severity === "degraded")
							currentStatusForReport = "degraded";
						else currentStatusForReport = "major_outage";

						if (worstSeverityStatus === "operational")
							worstSeverityStatus = currentStatusForReport;
						else if (
							worstSeverityStatus === "degraded" &&
							(currentStatusForReport === "partial_outage" ||
								currentStatusForReport === "major_outage")
						)
							worstSeverityStatus = currentStatusForReport;
						else if (
							worstSeverityStatus === "partial_outage" &&
							currentStatusForReport === "major_outage"
						)
							worstSeverityStatus = currentStatusForReport;
					}

					return {
						...day,
						status: worstSeverityStatus,
						uptime: newUptime,
						duration: formatDuration(totalDurationMs),
					};
				}

				return day;
			});

			const knownDays = history.filter(
				(d) => d.status !== "unknown" && d.status !== "maintenance",
			);

			const avgUptime =
				knownDays.length > 0
					? knownDays.reduce((acc, curr) => acc + curr.uptime, 0) /
					knownDays.length
					: 100;

			return {
				...pm.monitor,
				history,
				avgUptime,
				currentStatus,
				group: pm.group,
				displayStyle: pm.style || "history",
				description: pm.description,
			};
		}),
	);

	const monitorsByGroup = monitorsData.reduce(
		(acc, monitor) => {
			const groupId = monitor.group?.id || "ungrouped";
			if (!acc[groupId]) {
				acc[groupId] = {
					group: monitor.group,
					monitors: [],
				};
			}
			acc[groupId].monitors.push(monitor);
			return acc;
		},
		{} as Record<
			string,
			{
				group: (typeof monitorsData)[0]["group"];
				monitors: typeof monitorsData;
			}
		>,
	);

	const sortedGroups = (
		Object.values(monitorsByGroup) as {
			group: MonitorGroup | null;
			monitors: Monitor[];
		}[]
	).sort((a, b) => {
		if (!a.group) return -1;
		if (!b.group) return 1;
		return (a.group.order ?? 0) - (b.group.order ?? 0);
	});

	const worstStatus = calculateAggregateStatus(
		monitorsData.map((m) => m.currentStatus),
	);

	const incidentsByDate = pastIncidents.reduce(
		(acc, incident) => {
			const date = new Date(incident.createdAt).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
			});

			if (!acc[date]) {
				acc[date] = [];
			}
			acc[date].push(incident);
			return acc;
		},
		{} as Record<string, typeof pastIncidents>,
	);

	const design = (pageConfig.design as any) || {};

	return {
		config: {
			id: pageConfig.id,
			name: pageConfig.name,
			slug: pageConfig.slug,
			design: {
				themeId: design.themeId || "default",
				theme: design.theme,
				logoUrl: design.logoUrl,
				faviconUrl: design.faviconUrl,
				contactUrl: design.contactUrl,
				customCss: design.customCss,
			},
		},
		overallStatus: worstStatus,
		monitorGroups: sortedGroups,
		activeIssues: combinedActive,
		scheduledMaintenances: scheduledMaintenances.map((m: any) => ({
			...m,
			detailsLink: buildPath(`/maintenance/${m.id}`, slug),
		})),
		pastIncidents: incidentsByDate,
		lastUpdated: new Date().toISOString(),
	};
}
