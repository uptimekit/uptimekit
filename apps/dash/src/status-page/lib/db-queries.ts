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

async function getPublishedIncidentRecords(
    statusPageId: string,
    options?: {
        activeOnly?: boolean;
        resolvedOnly?: boolean;
        limit?: number;
        cutoff?: Date;
        maintenanceOnly?: boolean;
        sortBy?: "startedAt" | "endedAt";
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
        .orderBy(
            desc(
                options?.sortBy === "endedAt"
                    ? incident.endedAt
                    : incident.startedAt,
            ),
        )
        .$dynamic();

    if (options?.limit) {
        incidentIdsQuery = incidentIdsQuery.limit(options.limit);
    }

    const incidentIds = (await incidentIdsQuery).map((row) => row.incidentId);

    if (incidentIds.length === 0) {
        return [];
    }

    return db.query.incidentStatusPage.findMany({
        columns: {
            incidentId: true,
            statusPageId: true,
        },
        where: and(
            eq(incidentStatusPage.statusPageId, statusPageId),
            inArray(incidentStatusPage.incidentId, incidentIds),
        ),
        with: {
            incident: {
                columns: {
                    id: true,
                    title: true,
                    status: true,
                    severity: true,
                    description: true,
                    startedAt: true,
                    plannedEndAt: true,
                    endedAt: true,
                    createdAt: true,
                },
                with: {
                    monitors: {
                        columns: {
                            incidentId: true,
                            monitorId: true,
                        },
                        with: {
                            monitor: {
                                columns: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    activities: {
                        columns: {
                            id: true,
                            message: true,
                            type: true,
                            createdAt: true,
                        },
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
    return withRetry(async () => {
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
    });
};

export type StatusPageData = NonNullable<
    Awaited<ReturnType<typeof getStatusPageByDomain>>
>;

async function getStatusPageMonitorRecords(statusPageId: string) {
    const records = await db.query.statusPageMonitor.findMany({
        where: eq(statusPageMonitor.statusPageId, statusPageId),
        columns: {
            statusPageId: true,
            monitorId: true,
            groupId: true,
            style: true,
            description: true,
            order: true,
        },
        with: {
            monitor: {
                columns: {
                    id: true,
                    name: true,
                    type: true,
                    workerIds: true,
                    locations: true,
                },
            },
            group: {
                columns: {
                    id: true,
                    name: true,
                    order: true,
                    collapsible: true,
                    defaultCollapsed: true,
                },
            },
        },
        orderBy: [asc(statusPageMonitor.order)],
    });

    const externalMonitorIds: string[] = [];
    for (const record of records) {
        if (record.monitor.type === "instatus") {
            externalMonitorIds.push(record.monitor.id);
        }
    }

    if (externalMonitorIds.length === 0) {
        return records;
    }

    const externalMonitorConfigs = await db
        .select({ id: monitor.id, config: monitor.config })
        .from(monitor)
        .where(inArray(monitor.id, externalMonitorIds));
    const configByMonitorId = new Map(
        externalMonitorConfigs.map((record) => [record.id, record.config]),
    );

    return records.map((record) => ({
        ...record,
        monitor: {
            ...record.monitor,
            config: configByMonitorId.get(record.monitor.id) ?? null,
        },
    }));
}

export const getStatusPageByDomain = cache(async (domain: string) => {
    return withRetry(async () => {
        const page = await db.query.statusPage.findFirst({
            where: eq(statusPage.domain, domain),
            columns: {
                id: true,
                name: true,
                slug: true,
                domain: true,
                design: true,
                public: true,
                password: true,
            },
        });

        if (!page) {
            return undefined;
        }

        const monitors = await getStatusPageMonitorRecords(page.id);

        return {
            ...page,
            monitors,
        };
    });
});

export const getStatusPageBySlug = cache(async (slug: string) => {
    return withRetry(async () => {
        const page = await db.query.statusPage.findFirst({
            where: eq(statusPage.slug, slug),
            columns: {
                id: true,
                name: true,
                slug: true,
                domain: true,
                design: true,
                public: true,
                password: true,
            },
        });

        if (!page) {
            return undefined;
        }

        const monitors = await getStatusPageMonitorRecords(page.id);

        return {
            ...page,
            monitors,
        };
    });
});

export const getActiveMaintenances = async (statusPageId: string) => {
    return withRetry(async () =>
        (
            await getPublishedIncidentRecords(statusPageId, {
                maintenanceOnly: true,
            })
        )
            .flatMap((record) => {
                const item = mapPublishedMaintenanceRecord(record);
                return item.status === "in_progress" ? [item] : [];
            })
            .sort(
                (a, b) =>
                    new Date(b.startAt).getTime() -
                    new Date(a.startAt).getTime(),
            ),
    );
};

export const getScheduledMaintenances = async (statusPageId: string) => {
    return withRetry(async () => {
        return (
            await getPublishedIncidentRecords(statusPageId, {
                maintenanceOnly: true,
            })
        )
            .flatMap((record) => {
                const item = mapPublishedMaintenanceRecord(record);
                return item.status === "scheduled" ? [item] : [];
            })
            .sort(
                (a, b) =>
                    new Date(a.startAt).getTime() -
                    new Date(b.startAt).getTime(),
            );
    });
};

export const getActiveStatusPageReports = async (statusPageId: string) => {
    return withRetry(async () =>
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
    return withRetry(async () =>
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
    return withRetry(async () =>
        (
            await getPublishedIncidentRecords(statusPageId, {
                maintenanceOnly: true,
                resolvedOnly: true,
                sortBy: "endedAt",
                limit,
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

    return withRetry(async () => {
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
    });
};

export const getMaintenanceHistoryForPeriod = async (
    statusPageId: string,
    options: HistoryQueryOptions = {},
) => {
    const { limit, period = "all" } = options;
    const cutoff = getIncidentHistoryCutoff(period);

    return withRetry(async () => {
        const items = (
            await getPublishedIncidentRecords(statusPageId, {
                maintenanceOnly: true,
                resolvedOnly: true,
                cutoff: cutoff ?? undefined,
                sortBy: "endedAt",
                limit,
            })
        )
            .map(mapPublishedMaintenanceRecord)
            .sort(
                (a, b) =>
                    new Date(b.endAt ?? b.startAt).getTime() -
                    new Date(a.endAt ?? a.startAt).getTime(),
            );

        return limit ? items.slice(0, limit) : items;
    });
};

export const getMonitorStatus = async (monitorId: string) => {
    return withRetry(async () => {
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
                workerIds: (monitorRecord.workerIds as string[] | null) ?? [],
                locations: (monitorRecord.locations as string[] | null) ?? [],
            }),
        ]);

        return {
            status: aggregateStatus.status,
            timestamp: latestEvent?.timestamp,
        };
    });
};
