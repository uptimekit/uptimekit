import { db, postgresClient, timeseries } from "@uptimekit/db";
import {
    incident,
    incidentActivity,
    incidentMonitor,
    incidentStatusPage,
} from "@uptimekit/db/schema/incidents";
import { monitor } from "@uptimekit/db/schema/monitors";
import { statusPageMonitor } from "@uptimekit/db/schema/status-pages";
import { worker } from "@uptimekit/db/schema/workers";
import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import { type AppEventPayload, publishAppEvent } from "../../lib/events";
import {
    type AutomaticIncidentOpenEvaluation,
    type ConfiguredWorkerStateResult,
    getAggregateMonitorStatus,
    getConfiguredWorkerStates,
    getEffectiveMonitorWorkers,
    isAutomaticIncidentOpenEligible,
    isAutomaticIncidentResolveEligible,
    type WorkerStatusSnapshot,
} from "../../lib/monitor-status";
import { processPendingNotifications } from "../notifications";

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

interface ProcessedMonitorEventGroup {
    changesToInsert: MonitorChangeInsert[];
    incidentsToInsert: (typeof incident.$inferInsert)[];
    incidentUpdatesToApply: IncidentUpdate[];
    incidentMonitorsToInsert: (typeof incidentMonitor.$inferInsert)[];
    incidentStatusPagesToInsert: (typeof incidentStatusPage.$inferInsert)[];
    activitiesToInsert: (typeof incidentActivity.$inferInsert)[];
    eventsToDispatch: WorkerIncidentEventDispatch[];
}

interface IncidentUpdate {
    id: string;
    values: Partial<typeof incident.$inferInsert>;
}

type WorkerIncidentEventDispatch =
    | {
          event: "incident.created";
          payload: AppEventPayload<"incident.created">;
      }
    | {
          event: "incident.resolved";
          payload: AppEventPayload<"incident.resolved">;
      };

const monitorEventLocks = new Map<string, Promise<void>>();
type AutomaticIncidentTriggerStatus = "down" | "degraded";

function getAutomaticIncidentTitle(
    monitorName: string,
    triggerStatus: AutomaticIncidentTriggerStatus,
) {
    return triggerStatus === "degraded"
        ? `Monitor ${monitorName} is degraded`
        : `Monitor ${monitorName} is down`;
}

function getAutomaticIncidentSeverity(
    triggerStatus: AutomaticIncidentTriggerStatus,
) {
    return triggerStatus === "degraded" ? "minor" : "major";
}

function getAutomaticIncidentDescription(input: {
    monitorName: string;
    triggerStatus: AutomaticIncidentTriggerStatus;
    reason: string | null;
    error?: string;
}) {
    const summary =
        input.triggerStatus === "degraded"
            ? `Monitor ${input.monitorName} is degraded.`
            : `Monitor ${input.monitorName} is down.`;
    const details = [summary];

    if (input.reason) {
        details.push(`Reason: ${input.reason}`);
    }

    details.push(`Last failure: ${input.error || "Unknown error"}`);

    return details.join("\n\n");
}

function getAutomaticIncidentOpenedMessage(input: {
    triggerStatus: AutomaticIncidentTriggerStatus;
    reason: string | null;
}) {
    const statusText = input.triggerStatus === "degraded" ? "degraded" : "down";
    const details = [
        `Incident opened automatically. Monitor is ${statusText}.`,
    ];

    if (input.reason) {
        details.push(input.reason);
    }

    return details.join(" ");
}

function getAutomaticIncidentEscalatedMessage(input: {
    reason: string | null;
    error?: string;
    workerLabel: string;
}) {
    const details = ["Incident escalated automatically. Monitor is down."];

    if (input.reason) {
        details.push(input.reason);
    }

    details.push(
        `Last failure: ${input.error || "unknown error"}. (Worker: ${input.workerLabel})`,
    );

    return details.join(" ");
}

async function withMonitorEventLock<T>(
    monitorId: string,
    fn: () => Promise<T>,
) {
    const previous = monitorEventLocks.get(monitorId) ?? Promise.resolve();
    let releaseCurrentLock: () => void = () => {};
    const current = new Promise<void>((resolve) => {
        releaseCurrentLock = resolve;
    });
    const tail = previous.catch(() => undefined).then(() => current);
    monitorEventLocks.set(monitorId, tail);

    await previous.catch(() => undefined);

    try {
        return await postgresClient.begin(async (sql) => {
            await sql`select pg_advisory_xact_lock(hashtextextended(${monitorId}, 0))`;
            return fn();
        });
    } finally {
        releaseCurrentLock();
        if (monitorEventLocks.get(monitorId) === tail) {
            monitorEventLocks.delete(monitorId);
        }
    }
}

async function persistProcessedMonitorEventGroup(input: {
    processed: ProcessedMonitorEventGroup;
    monitorEvents: MonitorEvent[];
    workerId: string;
}) {
    const { processed, monitorEvents, workerId } = input;

    if (processed.changesToInsert.length > 0) {
        await timeseries.insertMonitorChanges(processed.changesToInsert);
    }

    await db.transaction(async (tx) => {
        if (processed.incidentsToInsert.length > 0) {
            await tx.insert(incident).values(processed.incidentsToInsert);
        }

        for (const update of processed.incidentUpdatesToApply) {
            await tx
                .update(incident)
                .set(update.values)
                .where(eq(incident.id, update.id));
        }

        if (processed.incidentMonitorsToInsert.length > 0) {
            await tx
                .insert(incidentMonitor)
                .values(processed.incidentMonitorsToInsert);
        }

        if (processed.incidentStatusPagesToInsert.length > 0) {
            await tx
                .insert(incidentStatusPage)
                .values(processed.incidentStatusPagesToInsert);
        }

        if (processed.activitiesToInsert.length > 0) {
            await tx
                .insert(incidentActivity)
                .values(processed.activitiesToInsert);
        }

        for (const eventToDispatch of processed.eventsToDispatch) {
            if (eventToDispatch.event === "incident.created") {
                await publishAppEvent(
                    "incident.created",
                    eventToDispatch.payload,
                    {
                        tx,
                    },
                );
                continue;
            }

            await publishAppEvent(
                "incident.resolved",
                eventToDispatch.payload,
                {
                    tx,
                },
            );
        }
    });

    if (processed.eventsToDispatch.length > 0) {
        await processPendingNotifications("worker-events");
    }

    if (monitorEvents.length > 0) {
        await timeseries.insertMonitorEvents(
            monitorEvents.map((event) => ({
                id: crypto.randomUUID(),
                monitorId: event.monitorId,
                status: event.status,
                latency: event.latency,
                timestamp: new Date(event.timestamp),
                statusCode: event.statusCode,
                error: event.error,
                location: event.location || workerId,
                dnsLookup: event.timings?.dnsLookup,
                tcpConnect: event.timings?.tcpConnect,
                tlsHandshake: event.timings?.tlsHandshake,
                ttfb: event.timings?.ttfb,
                transfer: event.timings?.transfer,
            })),
        );
    }
}

export {
    type AutomaticIncidentOpenEvaluation,
    type ConfiguredWorkerStateResult,
    getConfiguredWorkerStates,
    isAutomaticIncidentOpenEligible,
    isAutomaticIncidentResolveEligible,
    type WorkerStatusSnapshot,
};

/**
 * Retrieve active monitors assigned to the given worker location and return their runtime configuration.
 *
 * @param workerLocation - The worker location identifier used to filter monitors whose `locations` include this value
 * @returns An array of monitor configuration objects containing: `id`, `type`, `url` (defaults to `""`), `hostname` (defaults to `""`), `port` (defaults to `0`), `resolverServers`, `recordType`, `interval`, `timeout`, `method` (defaults to `"GET"`), `headers` (defaults to `{}`), `body`, `acceptedStatusCodes`, `keyword`, `jsonPath`, `expectedValue`, `checkSsl` (defaults to `true`), and `sslCertExpiryNotificationDays` (defaults to `30`)
 */
export async function getMonitorsForWorker(workerId: string) {
    const workerRecord = await db.query.worker.findFirst({
        where: eq(worker.id, workerId),
    });

    if (!workerRecord) {
        return [];
    }

    const allActiveMonitors = await db.query.monitor.findMany({
        where: (t, { eq }) => eq(t.active, true),
    });

    return allActiveMonitors
        .filter((m) => {
            const workerIds = (m.workerIds as string[] | null) ?? [];
            if (workerIds.length > 0) {
                return workerIds.includes(workerId);
            }
            const locations = (m.locations as string[] | null) ?? [];
            return locations.includes(workerRecord.location);
        })
        .map((m) => {
            const config = m.config as {
                url?: string;
                hostname?: string;
                port?: number;
                resolverServers?: string;
                recordType?: string;
                method?: string;
                headers?: Record<string, string>;
                body?: string;
                acceptedStatusCodes?: string;
                keyword?: string;
                jsonPath?: string;
                expectedValue?: string;
                checkSsl?: boolean;
                sslCertExpiryNotificationDays?: number;
            };
            return {
                id: m.id,
                type: m.type,
                url: config.url || "",
                hostname: config.hostname || "",
                port: config.port || 0,
                resolverServers: config.resolverServers || "",
                recordType: config.recordType || "",
                interval: m.interval,
                timeout: m.timeout,
                retries: m.retries,
                retryInterval: m.retryInterval,
                method: config.method || "GET",
                headers: config.headers || {},
                body: config.body,
                acceptedStatusCodes: config.acceptedStatusCodes,
                keyword: config.keyword,
                jsonPath: config.jsonPath,
                expectedValue: config.expectedValue,
                checkSsl: config.checkSsl ?? true,
                sslCertExpiryNotificationDays:
                    config.sslCertExpiryNotificationDays ?? 30,
            };
        });
}

/**
 * Process a batch of monitor events for a given worker location, persisting monitor changes, creating or resolving incidents, recording incident activities, and storing raw events.
 *
 * @param events - Array of monitor events to process
 * @param workerLocation - Worker location used as the event location when an event does not include one
 * @returns An object with `success: true` and `count` equal to the number of processed events
 */
export async function processMonitorEvents(
    events: MonitorEvent[],
    workerId: string,
) {
    // Group events by monitor
    const eventsByMonitor = new Map<string, MonitorEvent[]>();
    for (const event of events) {
        const list = eventsByMonitor.get(event.monitorId) || [];
        list.push(event);
        eventsByMonitor.set(event.monitorId, list);
    }

    for (const [monitorId, monitorEvents] of eventsByMonitor.entries()) {
        await withMonitorEventLock(monitorId, async () => {
            const processedGroup = await processMonitorEventGroup(
                monitorId,
                monitorEvents,
                workerId,
            );

            await persistProcessedMonitorEventGroup({
                processed: processedGroup,
                monitorEvents,
                workerId,
            });

            return processedGroup;
        });
    }

    return { success: true, count: events.length };
}

/**
 * Processes a batch of events for a single monitor, producing monitor change records,
 * opening or resolving automatic incidents based on the monitor's pending duration,
 * and recording incident-monitor mappings and incident activities. May emit incident events and update incident rows in the database.
 *
 * @param monitorId - ID of the monitor whose events are being processed
 * @param monitorEvents - Chronologically ordered (will be sorted if not) events for the monitor
 * @param workerLocation - Location identifier of the worker processing the events; used as a fallback event location
 * @param changesToInsert - Array that will be appended with MonitorChangeInsert entries to persist monitor status changes
 * @param incidentsToInsert - Array that will be appended with incident insert objects for newly created automatic incidents
 * @param incidentMonitorsToInsert - Array that will be appended with incident-monitor mapping entries for new incidents
 * @param activitiesToInsert - Array that will be appended with incident activity entries describing automated actions
 */
async function processMonitorEventGroup(
    monitorId: string,
    monitorEvents: MonitorEvent[],
    workerId: string,
): Promise<ProcessedMonitorEventGroup> {
    const result: ProcessedMonitorEventGroup = {
        changesToInsert: [],
        incidentsToInsert: [],
        incidentUpdatesToApply: [],
        incidentMonitorsToInsert: [],
        incidentStatusPagesToInsert: [],
        activitiesToInsert: [],
        eventsToDispatch: [],
    };

    const monitorConfig = await db.query.monitor.findFirst({
        where: eq(monitor.id, monitorId),
    });

    if (!monitorConfig) {
        console.warn(`Received events for unknown monitor: ${monitorId}`);
        return result;
    }

    const now = new Date();
    const activeMaintenance = await db
        .select({ id: incident.id })
        .from(incident)
        .innerJoin(incidentMonitor, eq(incident.id, incidentMonitor.incidentId))
        .where(
            and(
                eq(incidentMonitor.monitorId, monitorId),
                eq(incident.severity, "maintenance"),
                isNull(incident.endedAt),
                lte(incident.startedAt, now),
                or(
                    isNull(incident.plannedEndAt),
                    gt(incident.plannedEndAt, now),
                ),
            ),
        )
        .limit(1);

    const isUnderMaintenance = activeMaintenance.length > 0;

    if (isUnderMaintenance) {
        for (const event of monitorEvents) {
            event.status = "maintenance";
        }
    }

    // Fetch active automatic incident
    const activeIncidentList = await db
        .select({
            id: incident.id,
            status: incident.status,
            title: incident.title,
            description: incident.description,
            severity: incident.severity,
            endedAt: incident.endedAt,
            type: incident.type,
        })
        .from(incident)
        .innerJoin(incidentMonitor, eq(incident.id, incidentMonitor.incidentId))
        .where(
            and(
                eq(incidentMonitor.monitorId, monitorId),
                eq(incident.type, "automatic"),
                isNull(incident.endedAt),
            ),
        )
        .limit(1);

    let activeIncident: (typeof activeIncidentList)[0] | undefined =
        activeIncidentList[0];

    // Sort by timestamp
    monitorEvents.sort(
        (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    const monitorWorkerIds = Array.isArray(monitorConfig.workerIds)
        ? monitorConfig.workerIds
        : [];
    const monitorLocations = Array.isArray(monitorConfig.locations)
        ? monitorConfig.locations
        : [];
    const configuredWorkers = await getEffectiveMonitorWorkers({
        id: monitorConfig.id,
        workerIds: monitorWorkerIds,
        locations: monitorLocations,
    });
    const configuredWorkerIds = configuredWorkers.map(
        (configuredWorker) => configuredWorker.id,
    );
    const workerLabels = new Map(
        configuredWorkers.map((workerRecord) => [
            workerRecord.id,
            `${workerRecord.name} (${workerRecord.location.toUpperCase()})`,
        ]),
    );

    const latestWorkerStatuses =
        await timeseries.getLatestStatusPerLocation(monitorId);
    const workerStatusById = new Map<string, WorkerStatusSnapshot>();
    for (const workerStatus of latestWorkerStatuses) {
        workerStatusById.set(workerStatus.location, {
            status: workerStatus.status as MonitorEvent["status"],
            timestamp: workerStatus.timestamp,
        });
    }

    let currentStatus =
        latestWorkerStatuses.length > 0
            ? getAggregateMonitorStatus({
                  configuredWorkerIds,
                  workerStatusById,
                  isUnderMaintenance,
              }).status
            : undefined;

    for (const event of monitorEvents) {
        const eventTime = new Date(event.timestamp);
        const eventWorkerId = event.location || workerId;

        workerStatusById.set(eventWorkerId, {
            status: event.status,
            timestamp: eventTime,
        });

        const aggregateStatus = getAggregateMonitorStatus({
            configuredWorkerIds,
            workerStatusById,
            isUnderMaintenance,
            workerLabels,
        });
        const aggregateRuntimeStatus = aggregateStatus.status;
        const isChange =
            currentStatus !== undefined &&
            currentStatus !== aggregateRuntimeStatus;
        const isFirstEvent = currentStatus === undefined;

        if (isChange || isFirstEvent) {
            result.changesToInsert.push({
                id: crypto.randomUUID(),
                monitorId: event.monitorId,
                status: aggregateRuntimeStatus,
                timestamp: eventTime,
                location: eventWorkerId,
            });
            currentStatus = aggregateRuntimeStatus;
        }

        if (
            isAutomaticIncidentResolveEligible({
                configuredWorkerIds,
                workerStatusById,
                activeIncident,
            })
        ) {
            const resolvedIncident = activeIncident;
            if (!resolvedIncident) {
                continue;
            }

            result.incidentUpdatesToApply.push({
                id: resolvedIncident.id,
                values: {
                    status: "resolved",
                    endedAt: eventTime,
                    resolvedAt: eventTime,
                    updatedAt: eventTime,
                },
            });

            result.eventsToDispatch.push({
                event: "incident.resolved",
                payload: {
                    incidentId: resolvedIncident.id,
                    organizationId: monitorConfig.organizationId,
                    title: `Monitor ${monitorConfig.name} recovered`,
                    description:
                        aggregateRuntimeStatus === "maintenance"
                            ? "Monitor entered maintenance."
                            : "Monitor is back up in all configured workers.",
                    severity: resolvedIncident.severity as
                        | "minor"
                        | "major"
                        | "critical"
                        | "maintenance",
                },
            });

            result.activitiesToInsert.push({
                id: crypto.randomUUID(),
                incidentId: resolvedIncident.id,
                message:
                    aggregateRuntimeStatus === "maintenance"
                        ? "Monitor entered maintenance. Incident resolved automatically."
                        : "Monitor recovered in all configured workers. Incident resolved automatically.",
                type: "event",
                createdAt: eventTime,
                userId: null,
            });

            activeIncident = undefined;
            continue;
        }

        if (activeIncident && aggregateRuntimeStatus === "down") {
            const incidentTitle = getAutomaticIncidentTitle(
                monitorConfig.name,
                "down",
            );
            const incidentDescription = getAutomaticIncidentDescription({
                monitorName: monitorConfig.name,
                triggerStatus: "down",
                reason: aggregateStatus.statusReason,
                error: event.error,
            });

            if (
                activeIncident.title !== incidentTitle ||
                activeIncident.description !== incidentDescription ||
                activeIncident.severity !== "major"
            ) {
                result.incidentUpdatesToApply.push({
                    id: activeIncident.id,
                    values: {
                        title: incidentTitle,
                        description: incidentDescription,
                        severity: "major",
                        updatedAt: eventTime,
                    },
                });

                result.activitiesToInsert.push({
                    id: crypto.randomUUID(),
                    incidentId: activeIncident.id,
                    message: getAutomaticIncidentEscalatedMessage({
                        reason: aggregateStatus.statusReason,
                        error: event.error,
                        workerLabel:
                            workerLabels.get(eventWorkerId) || eventWorkerId,
                    }),
                    type: "event",
                    createdAt: eventTime,
                    userId: null,
                });

                activeIncident = {
                    ...activeIncident,
                    title: incidentTitle,
                    description: incidentDescription,
                    severity: "major",
                };
            }
        }

        const openEvaluation = isAutomaticIncidentOpenEligible({
            configuredWorkerIds,
            workerStatusById,
            activeIncident,
            eventTime,
            incidentPendingDurationSeconds:
                monitorConfig.incidentPendingDuration,
            isUnderMaintenance,
            workerLabels,
        });

        if (
            openEvaluation.eligible &&
            openEvaluation.triggerStatus &&
            openEvaluation.startedAt
        ) {
            const newIncidentId = crypto.randomUUID();
            const incidentTitle = getAutomaticIncidentTitle(
                monitorConfig.name,
                openEvaluation.triggerStatus,
            );
            const incidentDescription = getAutomaticIncidentDescription({
                monitorName: monitorConfig.name,
                triggerStatus: openEvaluation.triggerStatus,
                reason: openEvaluation.reason,
                error: event.error,
            });
            const incidentSeverity = getAutomaticIncidentSeverity(
                openEvaluation.triggerStatus,
            );
            activeIncident = {
                id: newIncidentId,
                status: "investigating",
                title: incidentTitle,
                description: incidentDescription,
                severity: incidentSeverity,
                endedAt: null,
                type: "automatic",
            };

            result.incidentsToInsert.push({
                id: newIncidentId,
                organizationId: monitorConfig.organizationId,
                title: incidentTitle,
                description: incidentDescription,
                status: "investigating",
                severity: incidentSeverity,
                type: "automatic",
                startedAt: openEvaluation.startedAt,
                endedAt: null,
                createdAt: eventTime,
                updatedAt: eventTime,
                resolvedAt: null,
            });

            result.incidentMonitorsToInsert.push({
                incidentId: newIncidentId,
                monitorId: monitorId,
            });

            if (monitorConfig.publishIncidentToStatusPage) {
                const statusPages = await db
                    .select({
                        statusPageId: statusPageMonitor.statusPageId,
                    })
                    .from(statusPageMonitor)
                    .where(eq(statusPageMonitor.monitorId, monitorId));

                for (const { statusPageId } of statusPages) {
                    result.incidentStatusPagesToInsert.push({
                        incidentId: newIncidentId,
                        statusPageId,
                    });
                }

                if (statusPages.length > 0) {
                    result.activitiesToInsert.push({
                        id: crypto.randomUUID(),
                        incidentId: newIncidentId,
                        message: `Published to ${statusPages.length} status page${statusPages.length === 1 ? "" : "s"} automatically.`,
                        type: "event",
                        createdAt: eventTime,
                        userId: null,
                    });
                }
            }

            result.activitiesToInsert.push({
                id: crypto.randomUUID(),
                incidentId: newIncidentId,
                message: getAutomaticIncidentOpenedMessage({
                    triggerStatus: openEvaluation.triggerStatus,
                    reason: openEvaluation.reason,
                }),
                type: "event",
                createdAt: eventTime,
                userId: null,
            });

            result.eventsToDispatch.push({
                event: "incident.created",
                payload: {
                    incidentId: newIncidentId,
                    organizationId: monitorConfig.organizationId,
                    title: incidentTitle,
                    description: incidentDescription,
                    severity: incidentSeverity,
                },
            });
        }
    }

    // `incidentRecoveryDuration` exists on the monitor schema but remains intentionally
    // unused here so this fix only changes multi-worker incident gating behavior.
    return result;
}
