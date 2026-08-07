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
import { getExternalMonitorStatus, isExternalMonitor } from "./external-status";
import { buildPath } from "./route-utils";
import {
    normalizeStatusPageDesign,
    prepareStatusPageConfig,
} from "./status-page-config";
import { calculateAggregateStatus } from "./status-utils";

const DAY_MS = 24 * 60 * 60 * 1000;

interface TimeRange {
    startMs: number;
    endMs: number;
}

function buildOperationalHistory(days = 90, endDate?: string): UptimeDay[] {
    const result: UptimeDay[] = [];
    let now: Date;
    if (endDate) {
        now = new Date(endDate);
    } else {
        const today = new Date();
        now = new Date(
            Date.UTC(
                today.getUTCFullYear(),
                today.getUTCMonth(),
                today.getUTCDate(),
            ),
        );
    }

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setUTCDate(d.getUTCDate() - i);
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

function getOverlapRange(
    startAt: Date | string,
    endAt: Date | string | null | undefined,
    dayStart: Date,
    dayEnd: Date,
): TimeRange | null {
    const startMs = new Date(startAt).getTime();
    const endMs = endAt ? new Date(endAt).getTime() : Date.now();
    const overlapStartMs = Math.max(startMs, dayStart.getTime());
    const overlapEndMs = Math.min(endMs, dayEnd.getTime());

    if (overlapEndMs <= overlapStartMs) {
        return null;
    }

    return {
        startMs: overlapStartMs,
        endMs: overlapEndMs,
    };
}

function mergeRanges(ranges: TimeRange[]): TimeRange[] {
    if (ranges.length <= 1) {
        return ranges.map((range) => ({ ...range }));
    }

    const sortedRanges = [...ranges].sort((a, b) => a.startMs - b.startMs);
    const mergedRanges: TimeRange[] = [{ ...sortedRanges[0] }];

    for (const range of sortedRanges.slice(1)) {
        const lastRange = mergedRanges[mergedRanges.length - 1];

        if (range.startMs <= lastRange.endMs) {
            lastRange.endMs = Math.max(lastRange.endMs, range.endMs);
            continue;
        }

        mergedRanges.push({ ...range });
    }

    return mergedRanges;
}

function sumRanges(ranges: TimeRange[]): number {
    return ranges.reduce(
        (total, range) => total + range.endMs - range.startMs,
        0,
    );
}

function subtractRanges(
    ranges: TimeRange[],
    exclusions: TimeRange[],
): TimeRange[] {
    let remainingRanges = mergeRanges(ranges);
    const mergedExclusions = mergeRanges(exclusions);

    for (const exclusion of mergedExclusions) {
        remainingRanges = remainingRanges.flatMap((range) => {
            if (
                exclusion.endMs <= range.startMs ||
                exclusion.startMs >= range.endMs
            ) {
                return [range];
            }

            const nextRanges: TimeRange[] = [];

            if (exclusion.startMs > range.startMs) {
                nextRanges.push({
                    startMs: range.startMs,
                    endMs: Math.min(exclusion.startMs, range.endMs),
                });
            }

            if (exclusion.endMs < range.endMs) {
                nextRanges.push({
                    startMs: Math.max(exclusion.endMs, range.startMs),
                    endMs: range.endMs,
                });
            }

            return nextRanges;
        });
    }

    return remainingRanges;
}

function getIncidentStatus(severity: string): StatusType {
    switch (severity) {
        case "minor":
        case "degraded":
            return "degraded";
        case "major":
            return "partial_outage";
        case "critical":
            return "major_outage";
        default:
            return "major_outage";
    }
}

function getWorstIncidentStatus(reports: any[]): StatusType {
    const rank: Record<StatusType, number> = {
        operational: 0,
        degraded: 1,
        partial_outage: 2,
        major_outage: 3,
        maintenance: 0,
        maintenance_scheduled: 0,
        maintenance_completed: 0,
        unknown: 0,
    };

    return reports.reduce<StatusType>((worstStatus, report) => {
        const currentStatus = getIncidentStatus(report.severity);

        return rank[currentStatus] > rank[worstStatus]
            ? currentStatus
            : worstStatus;
    }, "operational");
}

export async function prepareStatusPageData(
    pageConfig: any,
    routeSlug?: string,
): Promise<StatusPageData> {
    const design = normalizeStatusPageDesign(pageConfig.design);
    const { barDays } = design;

    const [
        activeReports,
        activeMaintenances,
        scheduledMaintenances,
        reports,
        maintenances,
        events,
    ] = await Promise.all([
        getActiveStatusPageReports(pageConfig.id),
        getActiveMaintenances(pageConfig.id),
        getScheduledMaintenances(pageConfig.id),
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
            monitors: r.affectedMonitors.map((am: any) => ({
                monitor: am.monitor,
            })),
            activities: r.updates.map((u: any) => ({
                id: u.id,
                message: u.message,
                createdAt: u.createdAt,
                type: "update",
            })),
            detailsLink: buildPath(`/incidents/${r.id}`, routeSlug),
        })),
        ...activeMaintenances.map((m: any) => ({
            id: m.id,
            title: m.title,
            status: m.status,
            severity: "maintenance",
            startedAt: m.startAt,
            endedAt: m.endAt,
            monitors: m.monitors,
            activities: m.updates.map((u: any) => ({
                id: u.id,
                message: u.message,
                createdAt: u.createdAt,
                type: u.type,
            })),
            detailsLink: buildPath(`/incidents/${m.id}`, routeSlug),
        })),
    ].sort(
        (a, b) =>
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );

    const pastIncidents = [
        ...reports.map((r: any) => ({
            id: r.id,
            title: r.title,
            status: r.status,
            severity: r.severity,
            startedAt: r.startedAt,
            endedAt: r.endedAt,
            monitors: r.affectedMonitors.map((am: any) => ({
                monitor: am.monitor,
            })),
            activities: r.updates.map((u: any) => ({
                id: u.id,
                message: u.message,
                createdAt: u.createdAt,
                type: "update",
            })),
            detailsLink: buildPath(`/incidents/${r.id}`, routeSlug),
        })),
        ...maintenances.map((m: any) => ({
            id: m.id,
            title: m.title,
            status: m.status,
            severity: "maintenance",
            startedAt: m.startAt,
            endedAt: m.endAt,
            monitors: m.monitors.map((mm: any) => ({ monitor: mm.monitor })),
            activities: m.updates.map((u: any) => ({
                id: u.id,
                message: u.message,
                createdAt: u.createdAt,
                type: u.type,
            })),
            detailsLink: buildPath(`/incidents/${m.id}`, routeSlug),
        })),
    ].sort(
        (a, b) =>
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
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
                r.affectedMonitors.some(
                    (am: any) => am.monitorId === pm.monitorId,
                ),
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
                if (isExternalMonitor(pm.monitor)) {
                    currentStatus =
                        (await getExternalMonitorStatus(pm.monitor)) ??
                        "unknown";
                } else {
                    const lastCheck = await getMonitorStatus(pm.monitorId);
                    if (lastCheck) {
                        if (lastCheck.status === "down")
                            currentStatus = "major_outage";
                        if (lastCheck.status === "degraded")
                            currentStatus = "degraded";
                        if (lastCheck.status === "maintenance")
                            currentStatus = "maintenance" as any;
                    }
                }
            }

            let history = buildOperationalHistory(barDays);

            history = history.map((day) => {
                const dayStart = new Date(day.date);
                dayStart.setUTCHours(0, 0, 0, 0);
                const dayEnd = new Date(day.date);
                dayEnd.setUTCHours(23, 59, 59, 999);

                const maintenanceItems = events.maintenances.flatMap(
                    (m: any) => {
                        const affectsMonitor = m.monitors.some(
                            (mm: any) => mm.monitorId === pm.monitorId,
                        );
                        if (!affectsMonitor) return [];

                        const range = getOverlapRange(
                            m.startAt,
                            m.endAt,
                            dayStart,
                            dayEnd,
                        );

                        return range ? [{ range, title: m.title }] : [];
                    },
                );
                const maintenanceRanges = maintenanceItems.map(
                    (item: any) => item.range,
                );
                const mergedMaintenanceRanges = mergeRanges(maintenanceRanges);
                const maintenanceMs = sumRanges(mergedMaintenanceRanges);
                const monitoredMs = Math.max(0, DAY_MS - maintenanceMs);
                const reportRanges: TimeRange[] = [];
                const reportsOutsideMaintenance: any[] = [];

                for (const r of events.reports) {
                    const affectsMonitor = r.affectedMonitors.some(
                        (am: any) => am.monitorId === pm.monitorId,
                    );
                    if (!affectsMonitor) continue;

                    const range = getOverlapRange(
                        r.startedAt,
                        r.endedAt,
                        dayStart,
                        dayEnd,
                    );
                    if (!range) continue;

                    const rangesOutsideMaintenance = subtractRanges(
                        [range],
                        mergedMaintenanceRanges,
                    );
                    if (rangesOutsideMaintenance.length === 0) continue;

                    reportRanges.push(...rangesOutsideMaintenance);
                    reportsOutsideMaintenance.push(r);
                }

                const totalIncidentMs = Math.min(
                    monitoredMs,
                    sumRanges(mergeRanges(reportRanges)),
                );
                const uptime =
                    monitoredMs > 0
                        ? Math.max(
                              0,
                              ((monitoredMs - totalIncidentMs) / monitoredMs) *
                                  100,
                          )
                        : 100;

                if (totalIncidentMs > 0) {
                    const annotation = Array.from(
                        new Set(
                            reportsOutsideMaintenance.flatMap((report: any) =>
                                report.title ? [report.title] : [],
                            ),
                        ),
                    ).join("\n");

                    return {
                        ...day,
                        status: getWorstIncidentStatus(
                            reportsOutsideMaintenance,
                        ),
                        uptime,
                        annotation,
                        downtimeMs: totalIncidentMs,
                        maintenanceMs,
                        monitoredMs,
                        duration: formatDuration(totalIncidentMs),
                    };
                }

                if (maintenanceMs > 0) {
                    const annotation = Array.from(
                        new Set(
                            maintenanceItems.flatMap((item: any) =>
                                item.title ? [item.title] : [],
                            ),
                        ),
                    ).join("\n");

                    return {
                        ...day,
                        status: "maintenance" as any,
                        uptime: 100,
                        annotation,
                        maintenanceMs,
                        monitoredMs,
                        duration: formatDuration(maintenanceMs),
                    };
                }

                return day;
            });

            const totalMonitoredMs = history.reduce(
                (total, day) => total + (day.monitoredMs ?? DAY_MS),
                0,
            );
            const totalUptimeMs = history.reduce(
                (total, day) =>
                    total + ((day.monitoredMs ?? DAY_MS) * day.uptime) / 100,
                0,
            );
            const avgUptime =
                totalMonitoredMs > 0
                    ? (totalUptimeMs / totalMonitoredMs) * 100
                    : 100;

            return {
                ...pm.monitor,
                history,
                avgUptime,
                currentStatus,
                group: pm.group,
                displayStyle: isExternalMonitor(pm.monitor)
                    ? "status"
                    : pm.style || "history",
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

    const worstStatus = calculateAggregateStatus([
        ...monitorsData.map((monitor) => monitor.currentStatus),
        ...activeReports.map((report: any) =>
            getIncidentStatus(report.severity),
        ),
        ...activeMaintenances.map(() => "maintenance" as const),
    ]);

    const incidentsByDate = pastIncidents.reduce(
        (acc, incident) => {
            const date = new Date(incident.startedAt).toLocaleDateString(
                "en-US",
                {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                },
            );

            if (!acc[date]) {
                acc[date] = [];
            }
            acc[date].push(incident);
            return acc;
        },
        {} as Record<string, typeof pastIncidents>,
    );

    return {
        config: prepareStatusPageConfig(pageConfig, routeSlug),
        overallStatus: worstStatus,
        monitorGroups: sortedGroups,
        activeIssues: combinedActive,
        scheduledMaintenances: scheduledMaintenances.map((m: any) => ({
            ...m,
            detailsLink: buildPath(`/incidents/${m.id}`, routeSlug),
        })),
        pastIncidents: incidentsByDate,
        lastUpdated: new Date().toISOString(),
    };
}
