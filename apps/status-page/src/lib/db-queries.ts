import { getAggregateMonitorStatusForMonitor } from "@uptimekit/api/lib/monitor-status";
import {
    db,
    incident,
    incidentActivity,
    incidentStatusPage,
    statusPage,
    statusPageMonitor,
    timeseries,
} from "@uptimekit/db";
import { monitor } from "@uptimekit/db/schema/monitors";
// ... imports
import {
    and,
    asc,
    desc,
    eq,
    gte,
    inArray,
    isNotNull,
    isNull,
    ne,
    or,
} from "drizzle-orm";
import { cache } from "react";
import {
    getIncidentHistoryCutoff,
    type IncidentHistoryPeriod,
} from "./incident-history";

// ... existing functions
import { redis } from "./redis";

// Retry wrapper for database queries to handle connection issues during startup
async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 10,
    initialDelayMs = 1000,
    serviceName = "Database",
): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            // Log the full error for debugging
            console.error(`${serviceName} error:`, error);
            // Only retry on connection errors
            if (error?.code === "ECONNREFUSED" || error?.code === "ENOTFOUND") {
                if (i < maxRetries - 1) {
                    // Exponential backoff: 1s, 2s, 4s, 8s, then cap at 10s
                    const delayMs = Math.min(initialDelayMs * 2 ** i, 10000);
                    console.log(
                        `${serviceName} connection failed, retrying in ${delayMs}ms... (attempt ${i + 1}/${maxRetries})`,
                    );
                    await new Promise((resolve) =>
                        setTimeout(resolve, delayMs),
                    );
                    continue;
                }
            }
            // For other errors, throw immediately
            throw error;
        }
    }
    throw lastError;
}

// Helper to cache data in Redis
// TTL in seconds
async function cached<T>(
    key: string,
    ttl: number,
    fetcher: () => Promise<T>,
): Promise<T> {
    try {
        const cachedData = await redis.get(key);
        if (cachedData) {
            return JSON.parse(cachedData) as T;
        }
    } catch (error) {
        console.error(`Redis get error for key ${key}:`, error);
    }

    // Wrap fetcher with retry logic for database connection issues
    const data = await withRetry(fetcher);

    try {
        if (data !== undefined) {
            await redis.set(key, JSON.stringify(data), "EX", ttl);
        }
    } catch (error) {
        console.error(`Redis set error for key ${key}:`, error);
    }

    return data;
}

async function getPublishedIncidentRecords(
    statusPageId: string,
    options?: {
        activeOnly?: boolean;
        resolvedOnly?: boolean;
        limit?: number;
        cutoff?: Date;
        maintenanceOnly?: boolean;
    },
) {
    const filters = [eq(incidentStatusPage.statusPageId, statusPageId)];

    filters.push(
        options?.maintenanceOnly
            ? eq(incident.severity, "maintenance")
            : ne(incident.severity, "maintenance"),
    );

    if (options?.activeOnly) {
        filters.push(isNull(incident.endedAt));
    }

    if (options?.resolvedOnly) {
        filters.push(isNotNull(incident.endedAt));
    }

    if (options?.cutoff) {
        const cutoff = options.cutoff;
        const cutoffFilter = or(
            gte(incident.startedAt, cutoff),
            isNull(incident.endedAt),
            gte(incident.endedAt, cutoff),
        );

        if (cutoffFilter) {
            filters.push(cutoffFilter);
        }
    }

    let incidentIdsQuery = db
        .select({
            incidentId: incidentStatusPage.incidentId,
        })
        .from(incidentStatusPage)
        .innerJoin(incident, eq(incident.id, incidentStatusPage.incidentId))
        .where(and(...filters))
        .orderBy(desc(incident.startedAt))
        .$dynamic();

    if (options?.limit) {
        incidentIdsQuery = incidentIdsQuery.limit(options.limit);
    }

    const incidentIds = (await incidentIdsQuery).map((row) => row.incidentId);

    if (incidentIds.length === 0) {
        return [];
    }

    return db.query.incidentStatusPage.findMany({
        where: and(
            eq(incidentStatusPage.statusPageId, statusPageId),
            inArray(incidentStatusPage.incidentId, incidentIds),
        ),
        with: {
            incident: {
                with: {
                    monitors: {
                        with: {
                            monitor: true,
                        },
                    },
                    activities: {
                        orderBy: [desc(incidentActivity.createdAt)],
                    },
                },
            },
        },
    });
}

function mapPublishedIncidentRecord(
    record: Awaited<ReturnType<typeof getPublishedIncidentRecords>>[number],
) {
    return {
        ...record.incident,
        affectedMonitors: record.incident.monitors.map((item) => ({
            monitorId: item.monitorId,
            monitor: item.monitor,
        })),
        updates: record.incident.activities,
    };
}

function getMaintenanceStatus(item: {
    startedAt: Date;
    plannedEndAt?: Date | null;
    endedAt: Date | null;
}) {
    const now = new Date();

    if (item.endedAt) return "completed";
    if (item.plannedEndAt && item.plannedEndAt <= now) return "completed";
    if (item.startedAt > now) return "scheduled";
    return "in_progress";
}

function mapPublishedMaintenanceRecord(
    record: Awaited<ReturnType<typeof getPublishedIncidentRecords>>[number],
) {
    const item = mapPublishedIncidentRecord(record);

    return {
        ...item,
        status: getMaintenanceStatus(item),
        startAt: item.startedAt,
        endAt: item.plannedEndAt ?? item.endedAt,
        monitors: item.affectedMonitors,
    };
}

export const getStatusPageEvents = async (statusPageId: string, days = 90) => {
    return cached(
        `status-page:events:${statusPageId}:${days}`,
        60, // 1 minute
        async () => {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const [reports, maintenances] = await Promise.all([
                getPublishedIncidentRecords(statusPageId, {
                    cutoff: startDate,
                }).then((records) =>
                    records
                        .map(mapPublishedIncidentRecord)
                        .sort(
                            (a, b) =>
                                new Date(b.startedAt).getTime() -
                                new Date(a.startedAt).getTime(),
                        ),
                ),
                getPublishedIncidentRecords(statusPageId, {
                    cutoff: startDate,
                    maintenanceOnly: true,
                }).then((records) =>
                    records
                        .map(mapPublishedMaintenanceRecord)
                        .sort(
                            (a, b) =>
                                new Date(b.startAt).getTime() -
                                new Date(a.startAt).getTime(),
                        ),
                ),
            ]);

            return { reports, maintenances };
        },
    );
};

export type StatusPageData = NonNullable<
    Awaited<ReturnType<typeof getStatusPageByDomain>>
>;

export const getStatusPageByDomain = async (domain: string) => {
    return cached(
        `status-page:${domain}`,
        600, // 10 minutes
        async () => {
            const page = await db.query.statusPage.findFirst({
                where: eq(statusPage.domain, domain),
            });

            if (!page) {
                return undefined;
            }

            const monitors = await db.query.statusPageMonitor.findMany({
                where: eq(statusPageMonitor.statusPageId, page.id),
                with: {
                    monitor: true,
                    group: true,
                },
                orderBy: [asc(statusPageMonitor.order)],
            });

            return {
                ...page,
                monitors,
            };
        },
    );
};

export const getStatusPageBySlug = cache(async (slug: string) => {
    return cached(
        `status-page:slug:${slug}`,
        600, // 10 minutes
        async () => {
            const page = await db.query.statusPage.findFirst({
                where: eq(statusPage.slug, slug),
            });

            if (!page) {
                return undefined;
            }

            const monitors = await db.query.statusPageMonitor.findMany({
                where: eq(statusPageMonitor.statusPageId, page.id),
                with: {
                    monitor: true,
                    group: true,
                },
                orderBy: [asc(statusPageMonitor.order)],
            });

            return {
                ...page,
                monitors,
            };
        },
    );
});

export const getMonitorUptime = async (monitorId: string, days = 90) => {
    return cached(
        `monitor-uptime:${monitorId}:${days}`,
        60, // 1 minute
        async () => {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const stats = await timeseries.getHourlyUptimeStats(
                monitorId,
                startDate,
            );
            return stats.map((s) => ({
                date_hour: s.dateHour,
                total_checks: s.totalChecks,
                up_checks: s.upChecks,
                avg_latency: s.avgLatency,
            }));
        },
    );
};

export const getActiveIncidents = async (organizationId: string) => {
    return cached(
        `active-incidents:${organizationId}`,
        60, // 1 minute
        async () => {
            return await db.query.incident.findMany({
                where: and(
                    eq(incident.organizationId, organizationId),
                    // active statuses
                    inArray(incident.status, [
                        "investigating",
                        "identified",
                        "monitoring",
                    ]),
                ),
                with: {
                    monitors: {
                        with: {
                            monitor: true,
                        },
                    },
                    activities: {
                        orderBy: (activities, { desc }) => [
                            desc(activities.createdAt),
                        ],
                        limit: 1,
                    },
                },
                orderBy: (incidents, { desc }) => [desc(incidents.createdAt)],
            });
        },
    );
};

export const getActiveMaintenances = async (statusPageId: string) => {
    return cached(
        `active-maintenances:${statusPageId}`,
        60, // 1 minute
        async () =>
            (
                await getPublishedIncidentRecords(statusPageId, {
                    maintenanceOnly: true,
                })
            )
                .map(mapPublishedMaintenanceRecord)
                .filter((item) => item.status === "in_progress")
                .sort(
                    (a, b) =>
                        new Date(b.startAt).getTime() -
                        new Date(a.startAt).getTime(),
                ),
    );
};

export const getScheduledMaintenances = async (statusPageId: string) => {
    return cached(`scheduled-maintenances:${statusPageId}`, 60, async () => {
        return (
            await getPublishedIncidentRecords(statusPageId, {
                maintenanceOnly: true,
            })
        )
            .map(mapPublishedMaintenanceRecord)
            .filter((item) => item.status === "scheduled")
            .sort(
                (a, b) =>
                    new Date(a.startAt).getTime() -
                    new Date(b.startAt).getTime(),
            );
    });
};

export const getActiveStatusPageReports = async (statusPageId: string) => {
    return cached(
        `active-status-page-reports:${statusPageId}`,
        60, // 1 minute
        async () =>
            (
                await getPublishedIncidentRecords(statusPageId, {
                    activeOnly: true,
                })
            )
                .map(mapPublishedIncidentRecord)
                .sort(
                    (a, b) =>
                        new Date(b.startedAt).getTime() -
                        new Date(a.startedAt).getTime(),
                ),
    );
};

export const getStatusPageReports = async (statusPageId: string, limit = 5) => {
    return cached(
        `status-page-reports:${statusPageId}:limit:${limit}`,
        60, // 1 minute
        async () =>
            (
                await getPublishedIncidentRecords(statusPageId, {
                    resolvedOnly: true,
                    limit,
                })
            )
                .map(mapPublishedIncidentRecord)
                .sort(
                    (a, b) =>
                        new Date(b.startedAt).getTime() -
                        new Date(a.startedAt).getTime(),
                ),
    );
};

export const getMaintenanceHistory = async (
    statusPageId: string,
    limit = 5,
) => {
    return cached(
        `maintenance-history:${statusPageId}:limit:${limit}`,
        60, // 1 minute
        async () =>
            (
                await getPublishedIncidentRecords(statusPageId, {
                    maintenanceOnly: true,
                    resolvedOnly: true,
                })
            )
                .map(mapPublishedMaintenanceRecord)
                .sort(
                    (a, b) =>
                        new Date(b.endAt ?? b.startAt).getTime() -
                        new Date(a.endAt ?? a.startAt).getTime(),
                )
                .slice(0, limit),
    );
};

interface HistoryQueryOptions {
    limit?: number;
    period?: IncidentHistoryPeriod;
}

export const getStatusPageReportsForPeriod = async (
    statusPageId: string,
    options: HistoryQueryOptions = {},
) => {
    const { limit, period = "all" } = options;
    const cutoff = getIncidentHistoryCutoff(period);

    return cached(
        `status-page-reports:${statusPageId}:period:${period}:limit:${limit ?? "all"}`,
        60,
        async () => {
            const records = await getPublishedIncidentRecords(statusPageId, {
                resolvedOnly: true,
                cutoff: cutoff ?? undefined,
                limit,
            });

            return records
                .map(mapPublishedIncidentRecord)
                .sort(
                    (a, b) =>
                        new Date(b.startedAt).getTime() -
                        new Date(a.startedAt).getTime(),
                );
        },
    );
};

export const getMaintenanceHistoryForPeriod = async (
    statusPageId: string,
    options: HistoryQueryOptions = {},
) => {
    const { limit, period = "all" } = options;
    const cutoff = getIncidentHistoryCutoff(period);

    return cached(
        `maintenance-history:${statusPageId}:period:${period}:limit:${limit ?? "all"}`,
        60,
        async () => {
            const items = (
                await getPublishedIncidentRecords(statusPageId, {
                    maintenanceOnly: true,
                    resolvedOnly: true,
                    cutoff: cutoff ?? undefined,
                })
            )
                .map(mapPublishedMaintenanceRecord)
                .sort(
                    (a, b) =>
                        new Date(b.endAt ?? b.startAt).getTime() -
                        new Date(a.endAt ?? a.startAt).getTime(),
                );

            return limit ? items.slice(0, limit) : items;
        },
    );
};

export const getMonitorStatus = async (monitorId: string) => {
    return cached(
        `monitor-status:${monitorId}`,
        60, // 1 minute (was 30s)
        async () => {
            const monitorRecord = await db.query.monitor.findFirst({
                where: eq(monitor.id, monitorId),
                columns: {
                    id: true,
                    workerIds: true,
                    locations: true,
                },
            });

            if (!monitorRecord) return undefined;

            const [latestEvent, aggregateStatus] = await Promise.all([
                timeseries.getLatestEventForMonitor(monitorId),
                getAggregateMonitorStatusForMonitor({
                    id: monitorRecord.id,
                    workerIds:
                        (monitorRecord.workerIds as string[] | null) ?? [],
                    locations:
                        (monitorRecord.locations as string[] | null) ?? [],
                }),
            ]);

            return {
                status: aggregateStatus.status,
                timestamp: latestEvent?.timestamp,
            };
        },
    );
};
