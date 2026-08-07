import type {
    IncidentDetailData,
    UpdatesPageData,
} from "@/status-page/themes/types";
import {
    getActiveMaintenances,
    getActiveStatusPageReports,
    getMaintenanceHistory,
    getMaintenanceHistoryForPeriod,
    getScheduledMaintenances,
    getStatusPageReports,
    getStatusPageReportsForPeriod,
} from "./db-queries";
import type { IncidentHistoryPeriod } from "./incident-history";
import { buildPath } from "./route-utils";
import { prepareStatusPageConfig } from "./status-page-config";

function mapIncident(report: any, routeSlug?: string) {
    return {
        id: report.id,
        title: report.title,
        status: report.status,
        severity: report.severity,
        startedAt: report.startedAt,
        endedAt: report.endedAt,
        monitors: report.affectedMonitors.map((am: any) => ({
            monitor: am.monitor,
        })),
        activities: report.updates.map((u: any) => ({
            id: u.id,
            message: u.message,
            createdAt: u.createdAt,
            type: u.type,
        })),
        detailsLink: buildPath(`/incidents/${report.id}`, routeSlug),
    };
}

function mapMaintenanceIncident(maintenance: any, routeSlug?: string) {
    return {
        id: maintenance.id,
        title: maintenance.title,
        status: maintenance.status,
        severity: "maintenance",
        startedAt: maintenance.startAt,
        endedAt: maintenance.endAt,
        monitors: maintenance.monitors,
        activities: maintenance.updates.map((u: any) => ({
            id: u.id,
            message: u.message,
            createdAt: u.createdAt,
            type: u.type,
        })),
        detailsLink: buildPath(`/incidents/${maintenance.id}`, routeSlug),
    };
}

export async function prepareIncidentDetailData(
    pageConfig: any,
    incidentId: string,
    routeSlug?: string,
): Promise<IncidentDetailData> {
    const [
        reports,
        activeReports,
        activeMaintenances,
        scheduledMaintenances,
        history,
    ] = await Promise.all([
        getStatusPageReports(pageConfig.id, 1000),
        getActiveStatusPageReports(pageConfig.id),
        getActiveMaintenances(pageConfig.id),
        getScheduledMaintenances(pageConfig.id),
        getMaintenanceHistory(pageConfig.id, 1000),
    ]);

    const reportItem =
        activeReports.find((r: any) => r.id === incidentId) ||
        reports.find((r: any) => r.id === incidentId);
    const maintenanceItem =
        activeMaintenances.find((m: any) => m.id === incidentId) ||
        scheduledMaintenances.find((m: any) => m.id === incidentId) ||
        history.find((m: any) => m.id === incidentId);

    if (!reportItem && !maintenanceItem) {
        throw new Error("Incident not found");
    }

    const activeIssues = [
        ...activeReports.map((report: any) => mapIncident(report, routeSlug)),
        ...activeMaintenances.map((maintenance: any) =>
            mapMaintenanceIncident(maintenance, routeSlug),
        ),
    ].sort(
        (a, b) =>
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );

    return {
        config: prepareStatusPageConfig(pageConfig, routeSlug),
        incident: reportItem
            ? mapIncident(reportItem, routeSlug)
            : mapMaintenanceIncident(maintenanceItem, routeSlug),
        activeIssues,
    };
}

export async function prepareUpdatesPageData(
    pageConfig: any,
    selectedPeriod: IncidentHistoryPeriod,
    routeSlug?: string,
): Promise<UpdatesPageData> {
    const limit = selectedPeriod === "all" ? undefined : 50;
    const [reports, maintenances, activeReports, activeMaintenances] =
        await Promise.all([
            getStatusPageReportsForPeriod(pageConfig.id, {
                limit,
                period: selectedPeriod,
            }),
            getMaintenanceHistoryForPeriod(pageConfig.id, {
                limit,
                period: selectedPeriod,
            }),
            getActiveStatusPageReports(pageConfig.id),
            getActiveMaintenances(pageConfig.id),
        ]);

    const allUpdates = [
        ...reports.map((report: any) => mapIncident(report, routeSlug)),
        ...maintenances.map((maintenance: any) =>
            mapMaintenanceIncident(maintenance, routeSlug),
        ),
    ].sort(
        (a, b) =>
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );

    const incidentsByDate = allUpdates.reduce(
        (acc, item) => {
            const date = new Date(item.startedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
            });
            if (!acc[date]) {
                acc[date] = [];
            }
            acc[date].push(item);
            return acc;
        },
        {} as Record<string, typeof allUpdates>,
    );

    const activeIssues = [
        ...activeReports.map((report: any) => mapIncident(report, routeSlug)),
        ...activeMaintenances.map((maintenance: any) =>
            mapMaintenanceIncident(maintenance, routeSlug),
        ),
    ].sort(
        (a, b) =>
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );

    return {
        config: prepareStatusPageConfig(pageConfig, routeSlug),
        allUpdates,
        incidentsByDate,
        activeIssues,
        selectedPeriod,
    };
}
