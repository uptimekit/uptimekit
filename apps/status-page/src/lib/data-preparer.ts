import type {
	Monitor,
	MonitorGroup,
	StatusPageData,
	StatusType,
	UptimeDay,
} from "@/themes/types";

import {
	getActiveMaintenances,
	getActiveStatusPageReports,
	getMaintenanceHistory,
	getMonitorStatus,
	getScheduledMaintenances,
	getStatusPageEvents,
	getStatusPageReports,
} from "./db-queries";
import { buildPath } from "./route-utils";
import { calculateAggregateStatus } from "./status-utils";

function buildOperationalHistory(
	days = 90,
	endDate?: string,
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

	for (let i = days - 1; i >= 0; i--) {
		const d = new Date(now);
		d.setDate(d.getDate() - i);
		const dateStr = d.toISOString().split("T")[0];

		result.push({
			date: dateStr,
			status: "operational",
			uptime: 100,
			downtimeMs: 0,
		});
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

function getBarDays(design: any): 30 | 60 | 90 {
	if (
		design?.barDays === 30 ||
		design?.barDays === 60 ||
		design?.barDays === 90
	) {
		return design.barDays;
	}
	return 90;
}

export async function prepareStatusPageData(
	pageConfig: any,
	slug?: string,
): Promise<StatusPageData> {
	const design = (pageConfig.design as any) || {};
	const barDays = getBarDays(design);

	const [activeReports, activeMaintenances, scheduledMaintenances] =
		await Promise.all([
			getActiveStatusPageReports(pageConfig.id),
			getActiveMaintenances(pageConfig.id),
			getScheduledMaintenances(pageConfig.id),
		]);

	const [reports, maintenances, events] = await Promise.all([
		getStatusPageReports(pageConfig.id),
		getMaintenanceHistory(pageConfig.id),
		getStatusPageEvents(pageConfig.id, barDays),
	]);

	const combinedActive = [
		...activeReports.map((r: any) => ({
			id: r.id,
			title: r.title,
			status: r.status,
			severity: r.severity,
			startedAt: r.startedAt,
			endedAt: r.endedAt,
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
			startedAt: m.createdAt,
			endedAt: m.endAt,
			monitors: m.monitors,
			activities: [],
			detailsLink: buildPath(`/maintenance/${m.id}`, slug),
		})),
	].sort(
		(a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
	);

	const pastIncidents = [
		...reports.map((r: any) => ({
			id: r.id,
			title: r.title,
			status: r.status,
			severity: r.severity,
			startedAt: r.startedAt,
			endedAt: r.endedAt,
			monitors: r.affectedMonitors.map((am: any) => ({ monitor: am.monitor })),
			activities: r.updates.map((u: any) => ({
				id: u.id,
				message: u.message,
				createdAt: u.createdAt,
				type: "update",
			})),
			detailsLink: buildPath(`/incidents/${r.id}`, slug),
		})),
		...maintenances.map((m: any) => ({
			id: m.id,
			title: m.title,
			status: m.status,
			severity: "maintenance",
			startedAt: m.createdAt,
			endedAt: m.endAt,
			monitors: m.monitors.map((mm: any) => ({ monitor: mm.monitor })),
			activities: [],
			detailsLink: buildPath(`/maintenance/${m.id}`, slug),
		})),
	].sort(
		(a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
	);

	const monitorsData = await Promise.all(
		pageConfig.monitors.map(async (pm: any) => {
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

			let history = buildOperationalHistory(barDays);

			history = history.map((day) => {
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

					const start = new Date(r.startedAt);
					const end = r.endedAt ? new Date(r.endedAt) : new Date();

					return start <= dayEnd && end >= dayStart;
				});

				if (relevantReports.length > 0) {
					let totalDurationMs = 0;

					for (const r of relevantReports) {
						const start = new Date(r.startedAt);
						const end = r.endedAt ? new Date(r.endedAt) : new Date();

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

			const knownDays = history.filter((d) => d.status !== "maintenance");

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
			const date = new Date(incident.startedAt).toLocaleDateString("en-US", {
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
				headerLayout: design.headerLayout || "vertical",
				barStyle: design.barStyle || "normal",
				barDays,
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
