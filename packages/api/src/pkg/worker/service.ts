import { clickhouse, db } from "@uptimekit/db";
import {
    incident,
    incidentActivity,
    incidentMonitor,
} from "@uptimekit/db/schema/incidents";
import {
    maintenance,
    maintenanceMonitor,
} from "@uptimekit/db/schema/maintenance";
import { monitor } from "@uptimekit/db/schema/monitors";
import { and, eq, isNull } from "drizzle-orm";
import { eventBus } from "../../lib/events";
import type { LatestChangeResult, LatestEventResult } from "../../types/clickhouse";



// Types
export interface HTTPTimings {
    dnsLookup?: number;
    tcpConnect?: number;
    tlsHandshake?: number;
    ttfb?: number;
    transfer?: number;
    total?: number;
}

export interface MonitorEvent {
    monitorId: string;
    status: "up" | "down" | "degraded" | "maintenance" | "pending";
    latency: number;
    timestamp: string | Date | number;
    statusCode?: number;
    error?: string;
    location?: string;
    timings?: HTTPTimings;
}

interface MonitorChangeInsert {
    id: string;
    monitorId: string;
    status: string;
    timestamp: Date;
    location?: string | null;
}

// Get monitors assigned to a worker location
export async function getMonitorsForWorker(workerLocation: string) {
    const allActiveMonitors = await db.query.monitor.findMany({
        where: (t, { eq }) => eq(t.active, true),
    });

    return allActiveMonitors
        .filter((m) => {
            const locations = m.locations as string[];
            return locations.includes(workerLocation);
        })
        .map((m) => {
            const config = m.config as {
                url?: string;
                hostname?: string;
                port?: number;
                method?: string;
                headers?: Record<string, string>;
                body?: string;
                acceptedStatusCodes?: string;
                keyword?: string;
                jsonPath?: string;
                expectedValue?: string;
            };
            return {
                id: m.id,
                type: m.type,
                url: config.url || "",
                hostname: config.hostname || "",
                port: config.port || 0,
                interval: m.interval,
                timeout: m.timeout,
                method: config.method || "GET",
                headers: config.headers || {},
                body: config.body,
                acceptedStatusCodes: config.acceptedStatusCodes,
                keyword: config.keyword,
                jsonPath: config.jsonPath,
                expectedValue: config.expectedValue,
            };
        });
}

// Process incoming monitor events
export async function processMonitorEvents(
    events: MonitorEvent[],
    workerLocation: string,
) {


    // Group events by monitor
    const eventsByMonitor = new Map<string, MonitorEvent[]>();
    for (const event of events) {
        const list = eventsByMonitor.get(event.monitorId) || [];
        list.push(event);
        eventsByMonitor.set(event.monitorId, list);
    }

    const changesToInsert: MonitorChangeInsert[] = [];
    const incidentsToInsert: (typeof incident.$inferInsert)[] = [];
    const incidentMonitorsToInsert: (typeof incidentMonitor.$inferInsert)[] = [];
    const activitiesToInsert: (typeof incidentActivity.$inferInsert)[] = [];

    for (const [monitorId, monitorEvents] of eventsByMonitor.entries()) {
        await processMonitorEventGroup(
            monitorId,
            monitorEvents,
            workerLocation,
            changesToInsert,
            incidentsToInsert,
            incidentMonitorsToInsert,
            activitiesToInsert,
        );
    }

    // Batch inserts
    if (changesToInsert.length > 0) {
        await clickhouse.insert({
            table: "uptimekit.monitor_changes",
            values: changesToInsert.map((c) => ({
                ...c,
                timestamp: new Date(c.timestamp!).getTime(),
            })),
            format: "JSONEachRow",
        });
    }

    if (incidentsToInsert.length > 0) {
        await db.insert(incident).values(incidentsToInsert);
        for (const inc of incidentsToInsert) {
            eventBus.emit("incident.created", {
                incidentId: inc.id,
                organizationId: inc.organizationId,
                title: inc.title,
                description: inc.description,
                severity: inc.severity as any,
            });
        }
    }

    if (incidentMonitorsToInsert.length > 0) {
        await db.insert(incidentMonitor).values(incidentMonitorsToInsert);
    }

    if (activitiesToInsert.length > 0) {
        await db.insert(incidentActivity).values(activitiesToInsert);
    }

    // Insert events to ClickHouse
    if (events.length > 0) {
        await clickhouse.insert({
            table: "uptimekit.monitor_events",
            values: events.map((e) => ({
                id: crypto.randomUUID(),
                monitorId: e.monitorId,
                status: e.status,
                latency: e.latency,
                timestamp: new Date(e.timestamp).getTime(),
                statusCode: e.statusCode,
                error: e.error,
                location: e.location || workerLocation,
                dnsLookup: e.timings?.dnsLookup,
                tcpConnect: e.timings?.tcpConnect,
                tlsHandshake: e.timings?.tlsHandshake,
                ttfb: e.timings?.ttfb,
                transfer: e.timings?.transfer,
            })),
            format: "JSONEachRow",
        });
    }

    return { success: true, count: events.length };
}

// Process events for a single monitor
async function processMonitorEventGroup(
    monitorId: string,
    monitorEvents: MonitorEvent[],
    workerLocation: string,
    changesToInsert: MonitorChangeInsert[],
    incidentsToInsert: (typeof incident.$inferInsert)[],
    incidentMonitorsToInsert: (typeof incidentMonitor.$inferInsert)[],
    activitiesToInsert: (typeof incidentActivity.$inferInsert)[],
) {
    const monitorConfig = await db.query.monitor.findFirst({
        where: eq(monitor.id, monitorId),
    });

    if (!monitorConfig) {
        console.warn(`Received events for unknown monitor: ${monitorId}`);
        return;
    }

    // Check for active maintenance
    const activeMaintenance = await db
        .select({ id: maintenance.id })
        .from(maintenance)
        .innerJoin(maintenanceMonitor, eq(maintenance.id, maintenanceMonitor.maintenanceId))
        .where(
            and(
                eq(maintenanceMonitor.monitorId, monitorId),
                eq(maintenance.status, "in_progress"),
            ),
        )
        .limit(1);

    if (activeMaintenance.length > 0) {
        for (const event of monitorEvents) {
            event.status = "maintenance";
        }
    }

    // Fetch active automatic incident
    const activeIncidentList = await db
        .select({
            id: incident.id,
            status: incident.status,
            resolvedAt: incident.resolvedAt,
            type: incident.type,
        })
        .from(incident)
        .innerJoin(incidentMonitor, eq(incident.id, incidentMonitor.incidentId))
        .where(
            and(
                eq(incidentMonitor.monitorId, monitorId),
                eq(incident.type, "automatic"),
                isNull(incident.resolvedAt),
            ),
        )
        .limit(1);

    let activeIncident: typeof activeIncidentList[0] | undefined = activeIncidentList[0];

    // Sort by timestamp
    monitorEvents.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    // Get latest status from ClickHouse
    const lastEventQuery = await clickhouse.query({
        query: `SELECT status, timestamp FROM uptimekit.monitor_events WHERE monitorId = {monitorId:String} ORDER BY timestamp DESC LIMIT 1`,
        query_params: { monitorId },
        format: "JSON",
    });
    const lastEventJson = await lastEventQuery.json<any>();
    const lastEvent = (lastEventJson.data as LatestEventResult[])[0];

    const lastChangeQuery = await clickhouse.query({
        query: `SELECT status, timestamp FROM uptimekit.monitor_changes WHERE monitorId = {monitorId:String} ORDER BY timestamp DESC LIMIT 1`,
        query_params: { monitorId },
        format: "JSON",
    });
    const lastChangeJson = await lastChangeQuery.json<any>();
    const lastChangeRecord = (lastChangeJson.data as LatestChangeResult[])[0];

    let currentStatus = lastEvent?.status;
    let lastChangeTime = lastChangeRecord?.timestamp
        ? new Date(lastChangeRecord.timestamp)
        : lastEvent?.timestamp
            ? new Date(lastEvent.timestamp)
            : new Date();

    for (const event of monitorEvents) {
        const eventTime = new Date(event.timestamp);
        const isChange = currentStatus !== undefined && currentStatus !== event.status;
        const isFirstEvent = currentStatus === undefined;

        if (isChange || isFirstEvent) {
            changesToInsert.push({
                id: crypto.randomUUID(),
                monitorId: event.monitorId,
                status: event.status,
                timestamp: eventTime,
                location: event.location || workerLocation,
            });
            currentStatus = event.status;
            lastChangeTime = eventTime;
        }

        // Incident logic
        if (currentStatus === "down") {
            const durationMs = eventTime.getTime() - lastChangeTime.getTime();
            const pendingMs = monitorConfig.incidentPendingDuration * 1000;

            if (durationMs >= pendingMs && !activeIncident) {
                const newIncidentId = crypto.randomUUID();
                activeIncident = {
                    id: newIncidentId,
                    status: "investigating",
                    resolvedAt: null,
                    type: "automatic",
                };

                incidentsToInsert.push({
                    id: newIncidentId,
                    organizationId: monitorConfig.organizationId,
                    title: `Monitor ${monitorConfig.name} is down`,
                    description: `Monitor ${monitorConfig.name} is down. \n\nError: ${event.error || "Unknown error"}`,
                    status: "investigating",
                    severity: "major",
                    type: "automatic",
                    createdAt: eventTime,
                    updatedAt: eventTime,
                });

                incidentMonitorsToInsert.push({
                    incidentId: newIncidentId,
                    monitorId: monitorId,
                });

                activitiesToInsert.push({
                    id: crypto.randomUUID(),
                    incidentId: newIncidentId,
                    message: `Incident opened automatically. Monitor reported down due to: ${event.error || "unknown error"}. (Region: ${event.location || workerLocation})`,
                    type: "event",
                    createdAt: eventTime,
                    userId: null,
                });
            }
        } else if (currentStatus === "up" && activeIncident) {
            await db
                .update(incident)
                .set({
                    status: "resolved",
                    resolvedAt: eventTime,
                    updatedAt: eventTime,
                })
                .where(eq(incident.id, activeIncident.id));

            eventBus.emit("incident.resolved", {
                incidentId: activeIncident.id,
                organizationId: monitorConfig.organizationId,
                title: `Monitor ${monitorConfig.name} recovered`,
                description: "Monitor is back up.",
                severity: "major",
            });

            activitiesToInsert.push({
                id: crypto.randomUUID(),
                incidentId: activeIncident.id,
                message: "Monitor recovered. Incident resolved automatically.",
                type: "event",
                createdAt: eventTime,
                userId: null,
            });

            activeIncident = undefined;
        }
    }
}
