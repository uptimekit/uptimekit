import {
    getMaintenanceStatus,
    type MaintenanceStatus,
} from "@uptimekit/api/lib/maintenance-status";
import type { StatusPageData, StatusType } from "@/status-page/themes/types";
import { isStatusPagePubliclyAccessible } from "./access-check";
import { getStatusPageData } from "./data-preparer";
import { getStatusPageEvents, type StatusPageRecord } from "./db-queries";
import { buildPath, getRequestOrigin } from "./route-utils";
import { createTtlCache } from "./ttl-cache";

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
// The event query uses calendar days, which can be shorter than 24 hours
// across DST changes; fetch a wider range and apply the exact window here.
const EVENT_QUERY_DAYS = 2;
const SUMMARY_CACHE_TTL_MS = 15_000;

type StatusPageEvents = Awaited<ReturnType<typeof getStatusPageEvents>>;
type SummaryPageStatus =
    | "operational"
    | "degraded"
    | "outage"
    | "maintenance"
    | "unknown";
type SummaryComponentStatus =
    | "up"
    | "down"
    | "degraded"
    | "maintenance"
    | "pending";

export interface StatusPageSummary {
    page: { id: string; name: string; url: string };
    status: SummaryPageStatus;
    updatedAt: string;
    components: {
        id: string;
        name: string;
        group: string | null;
        status: SummaryComponentStatus;
    }[];
    incidents: {
        id: string;
        title: string;
        status: string;
        severity: string;
        startedAt: string;
        updatedAt: string;
        resolvedAt: string | null;
        url: string;
        componentIds: string[];
        latestUpdate: { message: string; createdAt: string } | null;
    }[];
    maintenances: {
        id: string;
        title: string;
        description: string | null;
        status: MaintenanceStatus;
        startAt: string;
        endAt: string | null;
        url: string;
        componentIds: string[];
    }[];
}

interface SummaryInput {
    data: StatusPageData;
    events: StatusPageEvents;
    origin: string;
    routeSlug?: string;
    now?: Date;
}

const summaryCache = createTtlCache<StatusPageSummary>({
    ttlMs: SUMMARY_CACHE_TTL_MS,
    maxEntries: 500,
});

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
};

export function statusSummaryNotFound() {
    return Response.json(
        { error: "Not found" },
        {
            status: 404,
            headers: { ...corsHeaders, "Cache-Control": "no-store" },
        },
    );
}

export function statusSummaryPreflight() {
    return new Response(null, {
        status: 204,
        headers: {
            ...corsHeaders,
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400",
        },
    });
}

export function statusSummaryResponse(summary: StatusPageSummary) {
    return Response.json(summary, {
        headers: {
            ...corsHeaders,
            "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        },
    });
}

export async function renderStatusSummary({
    request,
    pageConfig,
    routeSlug,
}: {
    request: Request;
    pageConfig: StatusPageRecord;
    routeSlug?: string;
}) {
    // The response is publicly cacheable and readable from any origin, so a
    // password cookie must never unlock it.
    if (!isStatusPagePubliclyAccessible(pageConfig)) {
        return statusSummaryNotFound();
    }

    const origin = getRequestOrigin(request);
    const summary = await summaryCache.get(
        `${pageConfig.id}\u001f${routeSlug ?? ""}\u001f${origin}`,
        async () => {
            const [data, events] = await Promise.all([
                getStatusPageData(pageConfig, routeSlug),
                getStatusPageEvents(pageConfig.id, EVENT_QUERY_DAYS),
            ]);

            return buildStatusPageSummary({ data, events, origin, routeSlug });
        },
    );

    return statusSummaryResponse(summary);
}

export function buildStatusPageSummary({
    data,
    events,
    origin,
    routeSlug,
    now = new Date(),
}: SummaryInput): StatusPageSummary {
    const recentCutoff = now.getTime() - RECENT_WINDOW_MS;
    const toUrl = (path: string) =>
        new URL(buildPath(path, routeSlug) || "/", origin).toString();
    const components = data.monitorGroups.flatMap(({ group, monitors }) =>
        monitors.map((monitor) => ({
            id: monitor.id,
            name: monitor.name,
            group: group?.name ?? null,
            status: toComponentStatus(monitor.currentStatus),
        })),
    );
    const visibleComponentIds = new Set(components.map(({ id }) => id));
    const toComponentIds = (monitors: { monitorId: string }[]) =>
        monitors.flatMap(({ monitorId }) =>
            visibleComponentIds.has(monitorId) ? [monitorId] : [],
        );

    const incidents = events.reports
        .filter((report) => isWithinWindow(report.endedAt, recentCutoff))
        .map((report) => {
            const latestUpdate = report.updates[0];

            return {
                id: report.id,
                title: report.title,
                status: report.status,
                severity: report.severity,
                startedAt: report.startedAt.toISOString(),
                updatedAt: getLatestDate([
                    report.startedAt,
                    report.endedAt,
                    latestUpdate?.createdAt,
                ]).toISOString(),
                resolvedAt: report.endedAt?.toISOString() ?? null,
                url: toUrl(`/incidents/${report.id}`),
                componentIds: toComponentIds(report.affectedMonitors),
                latestUpdate: latestUpdate
                    ? {
                          message: latestUpdate.message,
                          createdAt: latestUpdate.createdAt.toISOString(),
                      }
                    : null,
            };
        });

    const maintenances = events.maintenances.flatMap((maintenance) => {
        const status = getMaintenanceStatus(maintenance, now);
        const endAt = maintenance.endedAt ?? maintenance.plannedEndAt ?? null;

        if (status === "completed" && !isWithinWindow(endAt, recentCutoff)) {
            return [];
        }

        return [
            {
                id: maintenance.id,
                title: maintenance.title,
                description: maintenance.description ?? null,
                status,
                startAt: maintenance.startedAt.toISOString(),
                endAt: endAt?.toISOString() ?? null,
                url: toUrl(`/incidents/${maintenance.id}`),
                componentIds: toComponentIds(maintenance.monitors),
            },
        ];
    });

    return {
        page: {
            id: data.config.id,
            name: data.config.name,
            url: toUrl(""),
        },
        status: toPageStatus(data.overallStatus),
        updatedAt: data.lastUpdated,
        components,
        incidents,
        maintenances,
    };
}

function isWithinWindow(endedAt: Date | null, cutoffMs: number) {
    return !endedAt || endedAt.getTime() >= cutoffMs;
}

function getLatestDate(dates: (Date | null | undefined)[]) {
    return new Date(Math.max(...dates.map((date) => date?.getTime() ?? 0)));
}

function toComponentStatus(status: StatusType): SummaryComponentStatus {
    switch (status) {
        case "major_outage":
        case "partial_outage":
            return "down";
        case "degraded":
            return "degraded";
        case "maintenance":
            return "maintenance";
        case "unknown":
            return "pending";
        default:
            return "up";
    }
}

function toPageStatus(status: StatusType): SummaryPageStatus {
    switch (status) {
        case "major_outage":
        case "partial_outage":
            return "outage";
        case "degraded":
            return "degraded";
        case "maintenance":
            return "maintenance";
        case "unknown":
            return "unknown";
        default:
            return "operational";
    }
}
