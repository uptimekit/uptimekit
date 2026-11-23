import { db } from "@uptimekit/db";
import { incident, incidentMonitor } from "@uptimekit/db/schema/incidents";
import { worker } from "@uptimekit/db/schema/workers";
import { and, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import { getLatestMonitorLocationStatuses } from "./monitor-location-state";

type TransactionLike = Parameters<Parameters<typeof db.transaction>[0]>[0];
type QueryableDatabase = typeof db | TransactionLike;

export type MonitorRuntimeStatus =
    | "up"
    | "down"
    | "degraded"
    | "maintenance"
    | "pending";

export interface WorkerStatusSnapshot {
    status: MonitorRuntimeStatus;
    timestamp: Date;
    /** When the worker entered `status`; defaults to `timestamp`. */
    since?: Date;
}

export interface ConfiguredWorkerStateResult {
    allWorkersReporting: boolean;
    states: WorkerStatusSnapshot[];
}

export interface AggregateMonitorStatusResult
    extends ConfiguredWorkerStateResult {
    status: MonitorRuntimeStatus;
    lastCheck: Date | null;
    allWorkersDownSince: Date | null;
    statusReason: string | null;
    affectedWorkerIds: string[];
    downWorkerIds: string[];
    upWorkerIds: string[];
    pendingWorkerIds: string[];
}

export interface EffectiveMonitorWorker {
    id: string;
    name: string;
    location: string;
}

export interface MonitorCheckTiming {
    interval?: number; // in seconds
    timeout?: number; // in seconds
    retries?: number;
    retryInterval?: number; // in seconds
}

export interface MonitorWorkerAssignment extends MonitorCheckTiming {
    id: string;
    workerIds?: string[] | null;
    locations?: string[] | null;
}

export interface AutomaticIncidentOpenEvaluation {
    eligible: boolean;
    allWorkersDownSince: Date | null;
    triggerStatus: "down" | "degraded" | null;
    startedAt: Date | null;
    reason: string | null;
}

function unique(values: string[]) {
    return [...new Set(values.filter(Boolean))];
}

function getWorkerStatus(
    workerId: string,
    workerStatusById: Map<string, WorkerStatusSnapshot>,
) {
    const workerStatus = workerStatusById.get(workerId);
    return workerStatus
        ? normalizeMonitorStatus(workerStatus.status)
        : undefined;
}

function getWorkerIdsWithStatus(input: {
    configuredWorkerIds: string[];
    workerStatusById: Map<string, WorkerStatusSnapshot>;
    status: MonitorRuntimeStatus;
}) {
    return input.configuredWorkerIds.filter(
        (workerId) =>
            getWorkerStatus(workerId, input.workerStatusById) === input.status,
    );
}

function getPendingWorkerIds(input: {
    configuredWorkerIds: string[];
    workerStatusById: Map<string, WorkerStatusSnapshot>;
}) {
    return input.configuredWorkerIds.filter(
        (workerId) => !input.workerStatusById.has(workerId),
    );
}

function getAffectedWorkerIds(input: {
    status: MonitorRuntimeStatus;
    configuredWorkerIds: string[];
    workerStatusById: Map<string, WorkerStatusSnapshot>;
}) {
    if (input.status === "down") {
        return getWorkerIdsWithStatus({
            configuredWorkerIds: input.configuredWorkerIds,
            workerStatusById: input.workerStatusById,
            status: "down",
        });
    }

    if (input.status !== "degraded") {
        return [];
    }

    return input.configuredWorkerIds.filter((workerId) => {
        const status = getWorkerStatus(workerId, input.workerStatusById);
        return status !== undefined && status !== "up";
    });
}

function formatWorkerLabels(
    workerIds: string[],
    workerLabels?: Map<string, string>,
) {
    const labels = workerIds.map(
        (workerId) => workerLabels?.get(workerId) ?? workerId,
    );

    if (labels.length <= 3) {
        return labels.join(", ");
    }

    return `${labels.slice(0, 3).join(", ")} and ${labels.length - 3} more`;
}

function formatWorkerSubject(
    workerIds: string[],
    workerLabels?: Map<string, string>,
) {
    return {
        text: formatWorkerLabels(workerIds, workerLabels),
        verb: workerIds.length === 1 ? "is" : "are",
    };
}

function getAggregateStatusReason(input: {
    status: MonitorRuntimeStatus;
    configuredWorkerIds: string[];
    workerStatusById: Map<string, WorkerStatusSnapshot>;
    workerLabels?: Map<string, string>;
}) {
    if (input.status === "pending") {
        if (input.configuredWorkerIds.length === 0) {
            return "No active workers are assigned to this monitor.";
        }

        const pendingWorkerIds = getPendingWorkerIds(input);
        if (pendingWorkerIds.length === 0) {
            return "Waiting for enough worker reports to determine status.";
        }

        const pendingWorkers = formatWorkerSubject(
            pendingWorkerIds,
            input.workerLabels,
        );
        return `Waiting for ${pendingWorkers.text} to report.`;
    }

    if (input.status === "down") {
        const downWorkerIds = getWorkerIdsWithStatus({
            configuredWorkerIds: input.configuredWorkerIds,
            workerStatusById: input.workerStatusById,
            status: "down",
        });
        const downWorkers = formatWorkerSubject(
            downWorkerIds.length > 0
                ? downWorkerIds
                : input.configuredWorkerIds,
            input.workerLabels,
        );

        return `${downWorkers.text} ${downWorkers.verb} reporting down.`;
    }

    if (input.status !== "degraded") {
        return null;
    }

    const downWorkerIds = getWorkerIdsWithStatus({
        configuredWorkerIds: input.configuredWorkerIds,
        workerStatusById: input.workerStatusById,
        status: "down",
    });
    const upWorkerIds = getWorkerIdsWithStatus({
        configuredWorkerIds: input.configuredWorkerIds,
        workerStatusById: input.workerStatusById,
        status: "up",
    });

    if (downWorkerIds.length > 0) {
        const downWorkers = formatWorkerSubject(
            downWorkerIds,
            input.workerLabels,
        );

        if (upWorkerIds.length === 0) {
            return `${downWorkers.text} ${downWorkers.verb} reporting down.`;
        }

        const upWorkers = formatWorkerSubject(upWorkerIds, input.workerLabels);
        return `${downWorkers.text} ${downWorkers.verb} reporting down while ${upWorkers.text} ${upWorkers.verb} reporting up.`;
    }

    const degradedWorkerIds = getWorkerIdsWithStatus({
        configuredWorkerIds: input.configuredWorkerIds,
        workerStatusById: input.workerStatusById,
        status: "degraded",
    });

    if (degradedWorkerIds.length > 0) {
        const degradedWorkers = formatWorkerSubject(
            degradedWorkerIds,
            input.workerLabels,
        );
        return `${degradedWorkers.text} ${degradedWorkers.verb} reporting degraded.`;
    }

    return "Worker reports do not agree on an operational state.";
}

function buildAggregateMonitorStatusResult(input: {
    configuredWorkerIds: string[];
    workerStatusById: Map<string, WorkerStatusSnapshot>;
    configuredWorkerStates: ConfiguredWorkerStateResult;
    status: MonitorRuntimeStatus;
    allWorkersDownSince: Date | null;
    workerLabels?: Map<string, string>;
}): AggregateMonitorStatusResult {
    const downWorkerIds = getWorkerIdsWithStatus({
        configuredWorkerIds: input.configuredWorkerIds,
        workerStatusById: input.workerStatusById,
        status: "down",
    });
    const upWorkerIds = getWorkerIdsWithStatus({
        configuredWorkerIds: input.configuredWorkerIds,
        workerStatusById: input.workerStatusById,
        status: "up",
    });
    const pendingWorkerIds = getPendingWorkerIds({
        configuredWorkerIds: input.configuredWorkerIds,
        workerStatusById: input.workerStatusById,
    });

    return {
        ...input.configuredWorkerStates,
        status: input.status,
        lastCheck:
            input.workerStatusById.size > 0
                ? new Date(
                      Math.max(
                          ...Array.from(input.workerStatusById.values()).map(
                              (state) => state.timestamp.getTime(),
                          ),
                      ),
                  )
                : null,
        allWorkersDownSince: input.allWorkersDownSince,
        statusReason: getAggregateStatusReason({
            status: input.status,
            configuredWorkerIds: input.configuredWorkerIds,
            workerStatusById: input.workerStatusById,
            workerLabels: input.workerLabels,
        }),
        affectedWorkerIds: getAffectedWorkerIds({
            status: input.status,
            configuredWorkerIds: input.configuredWorkerIds,
            workerStatusById: input.workerStatusById,
        }),
        downWorkerIds,
        upWorkerIds,
        pendingWorkerIds,
    };
}

export function normalizeMonitorStatus(status: string): MonitorRuntimeStatus {
    switch (status.toLowerCase()) {
        case "up":
        case "down":
        case "degraded":
        case "maintenance":
        case "pending":
            return status.toLowerCase() as MonitorRuntimeStatus;
        default:
            return "pending";
    }
}

export function getConfiguredWorkerStates(
    configuredWorkerIds: string[],
    workerStatusById: Map<string, WorkerStatusSnapshot>,
): ConfiguredWorkerStateResult {
    if (configuredWorkerIds.length === 0) {
        return {
            allWorkersReporting: false,
            states: [],
        };
    }

    const states = configuredWorkerIds
        .map((workerId) => workerStatusById.get(workerId))
        .filter((state): state is WorkerStatusSnapshot => !!state);

    return {
        allWorkersReporting: states.length === configuredWorkerIds.length,
        states,
    };
}

export function getAggregateMonitorStatus(input: {
    configuredWorkerIds: string[];
    workerStatusById: Map<string, WorkerStatusSnapshot>;
    isUnderMaintenance?: boolean;
    workerLabels?: Map<string, string>;
}): AggregateMonitorStatusResult {
    if (input.isUnderMaintenance) {
        return buildAggregateMonitorStatusResult({
            configuredWorkerIds: input.configuredWorkerIds,
            workerStatusById: input.workerStatusById,
            configuredWorkerStates: {
                allWorkersReporting: true,
                states: [],
            },
            status: "maintenance",
            allWorkersDownSince: null,
            workerLabels: input.workerLabels,
        });
    }

    const configuredWorkerStates = getConfiguredWorkerStates(
        input.configuredWorkerIds,
        input.workerStatusById,
    );

    if (
        input.configuredWorkerIds.length === 0 ||
        !configuredWorkerStates.allWorkersReporting
    ) {
        return buildAggregateMonitorStatusResult({
            configuredWorkerIds: input.configuredWorkerIds,
            workerStatusById: input.workerStatusById,
            configuredWorkerStates,
            status: "pending",
            allWorkersDownSince: null,
            workerLabels: input.workerLabels,
        });
    }

    const allWorkersDown = configuredWorkerStates.states.every(
        (state) => state.status === "down",
    );

    if (allWorkersDown) {
        return buildAggregateMonitorStatusResult({
            configuredWorkerIds: input.configuredWorkerIds,
            workerStatusById: input.workerStatusById,
            configuredWorkerStates,
            status: "down",
            allWorkersDownSince: new Date(
                Math.max(
                    ...configuredWorkerStates.states.map((state) =>
                        (state.since ?? state.timestamp).getTime(),
                    ),
                ),
            ),
            workerLabels: input.workerLabels,
        });
    }

    if (
        configuredWorkerStates.states.some(
            (state) => state.status === "maintenance",
        )
    ) {
        return buildAggregateMonitorStatusResult({
            configuredWorkerIds: input.configuredWorkerIds,
            workerStatusById: input.workerStatusById,
            configuredWorkerStates,
            status: "maintenance",
            allWorkersDownSince: null,
            workerLabels: input.workerLabels,
        });
    }

    if (
        configuredWorkerStates.states.some((state) => state.status === "down")
    ) {
        return buildAggregateMonitorStatusResult({
            configuredWorkerIds: input.configuredWorkerIds,
            workerStatusById: input.workerStatusById,
            configuredWorkerStates,
            status: "degraded",
            allWorkersDownSince: null,
            workerLabels: input.workerLabels,
        });
    }

    if (configuredWorkerStates.states.every((state) => state.status === "up")) {
        return buildAggregateMonitorStatusResult({
            configuredWorkerIds: input.configuredWorkerIds,
            workerStatusById: input.workerStatusById,
            configuredWorkerStates,
            status: "up",
            allWorkersDownSince: null,
            workerLabels: input.workerLabels,
        });
    }

    return buildAggregateMonitorStatusResult({
        configuredWorkerIds: input.configuredWorkerIds,
        workerStatusById: input.workerStatusById,
        configuredWorkerStates,
        status: "degraded",
        allWorkersDownSince: null,
        workerLabels: input.workerLabels,
    });
}

export function isAutomaticIncidentOpenEligible(input: {
    configuredWorkerIds: string[];
    workerStatusById: Map<string, WorkerStatusSnapshot>;
    activeIncident: { id: string } | undefined;
    eventTime: Date;
    incidentPendingDurationSeconds: number;
    lastRecoveredAt?: Date | null;
    isUnderMaintenance?: boolean;
    workerLabels?: Map<string, string>;
}): AutomaticIncidentOpenEvaluation {
    if (input.activeIncident) {
        return {
            eligible: false,
            allWorkersDownSince: null,
            triggerStatus: null,
            startedAt: null,
            reason: null,
        };
    }

    const aggregateStatus = getAggregateMonitorStatus({
        configuredWorkerIds: input.configuredWorkerIds,
        workerStatusById: input.workerStatusById,
        isUnderMaintenance: input.isUnderMaintenance,
        workerLabels: input.workerLabels,
    });

    if (
        aggregateStatus.status !== "down" ||
        !aggregateStatus.allWorkersDownSince
    ) {
        return {
            eligible: false,
            allWorkersDownSince: aggregateStatus.allWorkersDownSince,
            triggerStatus: null,
            startedAt: null,
            reason: aggregateStatus.statusReason,
        };
    }

    // Late or out-of-order reports can carry failures from before the last
    // recovery; those belong to the incident that recovery closed. Incident end
    // dates are editable, so one after this report must not mute alerts.
    const recoveredAtMs = input.lastRecoveredAt?.getTime() ?? 0;
    const outageStartMs = Math.max(
        aggregateStatus.allWorkersDownSince.getTime(),
        recoveredAtMs <= input.eventTime.getTime() ? recoveredAtMs : 0,
    );
    const durationMs = input.eventTime.getTime() - outageStartMs;
    const eligible = durationMs >= input.incidentPendingDurationSeconds * 1000;

    return {
        eligible,
        allWorkersDownSince: aggregateStatus.allWorkersDownSince,
        triggerStatus: eligible ? "down" : null,
        startedAt: eligible ? new Date(outageStartMs) : null,
        reason: aggregateStatus.statusReason,
    };
}

export function isAutomaticIncidentResolveEligible(input: {
    configuredWorkerIds: string[];
    workerStatusById: Map<string, WorkerStatusSnapshot>;
    activeIncident: { id: string } | undefined;
    eventTime?: Date;
    incidentRecoveryDurationSeconds?: number;
}): boolean {
    if (!input.activeIncident) {
        return false;
    }

    const configuredWorkerStates = getConfiguredWorkerStates(
        input.configuredWorkerIds,
        input.workerStatusById,
    );

    if (
        input.configuredWorkerIds.length === 0 ||
        !configuredWorkerStates.allWorkersReporting
    ) {
        return false;
    }

    const aggregateStatus = getAggregateMonitorStatus({
        configuredWorkerIds: input.configuredWorkerIds,
        workerStatusById: input.workerStatusById,
    });

    if (aggregateStatus.status === "maintenance") {
        return true;
    }

    if (aggregateStatus.status !== "up") {
        return false;
    }

    const recoveryMs = (input.incidentRecoveryDurationSeconds ?? 0) * 1000;
    if (recoveryMs <= 0 || !input.eventTime) {
        return true;
    }

    // Every worker must have stayed up for the whole recovery window, so the
    // window starts when the last of them recovered.
    const eventTimeMs = input.eventTime.getTime();
    const allWorkersUpSinceMs = Math.max(
        ...input.configuredWorkerIds.map((workerId) => {
            const snapshot = input.workerStatusById.get(workerId);
            const upSince = snapshot?.since ?? snapshot?.timestamp;
            return upSince ? upSince.getTime() : eventTimeMs;
        }),
    );

    return eventTimeMs - allWorkersUpSinceMs >= recoveryMs;
}

async function getActiveMaintenanceMonitorIds(monitorIds: string[]) {
    if (monitorIds.length === 0) {
        return new Set<string>();
    }

    const now = new Date();
    const rows = await db
        .select({ monitorId: incidentMonitor.monitorId })
        .from(incidentMonitor)
        .innerJoin(incident, eq(incidentMonitor.incidentId, incident.id))
        .where(
            and(
                inArray(incidentMonitor.monitorId, monitorIds),
                eq(incident.severity, "maintenance"),
                isNull(incident.endedAt),
                lte(incident.startedAt, now),
                or(
                    isNull(incident.plannedEndAt),
                    gt(incident.plannedEndAt, now),
                ),
            ),
        );

    return new Set(rows.map((row) => row.monitorId));
}

const DEFAULT_CHECK_INTERVAL_SECONDS = 60;
const DEFAULT_CHECK_TIMEOUT_SECONDS = 48;
const DEFAULT_CHECK_RETRIES = 2;
const DEFAULT_RETRY_INTERVAL_SECONDS = 20;
const WORKER_REPORT_GRACE_SECONDS = 30;

// Workers send one result per check, after all retries.
export function getWorkerReportWindowMs(timing: MonitorCheckTiming = {}) {
    const interval = timing.interval ?? DEFAULT_CHECK_INTERVAL_SECONDS;
    const timeout = timing.timeout ?? DEFAULT_CHECK_TIMEOUT_SECONDS;
    const retries = Math.max(timing.retries ?? DEFAULT_CHECK_RETRIES, 0);
    const retryInterval =
        timing.retryInterval ?? DEFAULT_RETRY_INTERVAL_SECONDS;
    const checkDuration = (retries + 1) * timeout + retries * retryInterval;
    return (interval + checkDuration + WORKER_REPORT_GRACE_SECONDS) * 1000;
}

// A reporting gap breaks the streak, so a returning worker cannot carry an
// outage that was already resolved into a new incident.
export function getWorkerStatusSince(input: {
    previous: WorkerStatusSnapshot | undefined;
    status: MonitorRuntimeStatus;
    at: Date;
    timing?: MonitorCheckTiming;
}) {
    const { previous, at } = input;
    if (!previous || previous.status !== input.status) {
        return at;
    }

    const oldestAcceptedMs =
        at.getTime() - getWorkerReportWindowMs(input.timing);
    if (previous.timestamp.getTime() < oldestAcceptedMs) {
        return at;
    }

    return previous.since ?? previous.timestamp;
}

// A dead worker must not veto an outage with its last "up" report.
export function getReportingWorkerIds(input: {
    workerIds: string[];
    workerStatusById: Map<string, WorkerStatusSnapshot>;
    at: Date;
    timing?: MonitorCheckTiming;
    reportingWorkerId?: string;
}) {
    const oldestAcceptedMs =
        input.at.getTime() - getWorkerReportWindowMs(input.timing);
    const reportingWorkerIds = input.workerIds.filter((workerId) => {
        if (workerId === input.reportingWorkerId) {
            return true;
        }

        const snapshot = input.workerStatusById.get(workerId);
        return (
            snapshot === undefined ||
            snapshot.timestamp.getTime() >= oldestAcceptedMs
        );
    });

    return reportingWorkerIds.length > 0 ? reportingWorkerIds : input.workerIds;
}

export async function getEffectiveWorkersForMonitors(
    monitors: MonitorWorkerAssignment[],
    options: {
        activeOnly?: boolean;
        database?: QueryableDatabase;
    } = {},
) {
    const activeOnly = options.activeOnly ?? true;
    const database = options.database ?? db;
    const explicitWorkerIds = unique(
        monitors.flatMap((monitorRecord) => monitorRecord.workerIds ?? []),
    );
    const fallbackLocations = unique(
        monitors.flatMap((monitorRecord) =>
            (monitorRecord.workerIds ?? []).length > 0
                ? []
                : (monitorRecord.locations ?? []),
        ),
    );

    const [explicitWorkers, fallbackWorkers] = await Promise.all([
        explicitWorkerIds.length > 0
            ? database
                  .select({
                      id: worker.id,
                      name: worker.name,
                      location: worker.location,
                  })
                  .from(worker)
                  .where(
                      activeOnly
                          ? and(
                                inArray(worker.id, explicitWorkerIds),
                                eq(worker.active, true),
                            )
                          : inArray(worker.id, explicitWorkerIds),
                  )
            : Promise.resolve([]),
        fallbackLocations.length > 0
            ? database
                  .select({
                      id: worker.id,
                      name: worker.name,
                      location: worker.location,
                  })
                  .from(worker)
                  .where(
                      activeOnly
                          ? and(
                                inArray(worker.location, fallbackLocations),
                                eq(worker.active, true),
                            )
                          : inArray(worker.location, fallbackLocations),
                  )
            : Promise.resolve([]),
    ]);

    const explicitWorkersById = new Map(
        explicitWorkers.map((workerRecord) => [workerRecord.id, workerRecord]),
    );
    const fallbackWorkersByLocation = new Map<
        string,
        EffectiveMonitorWorker[]
    >();

    for (const workerRecord of fallbackWorkers) {
        const workersForLocation =
            fallbackWorkersByLocation.get(workerRecord.location) ?? [];
        workersForLocation.push(workerRecord);
        fallbackWorkersByLocation.set(
            workerRecord.location,
            workersForLocation,
        );
    }

    const workersByMonitorId = new Map<string, EffectiveMonitorWorker[]>();

    for (const monitorRecord of monitors) {
        const monitorWorkerIds = unique(monitorRecord.workerIds ?? []);
        const monitorLocations = unique(monitorRecord.locations ?? []);

        if (monitorWorkerIds.length > 0) {
            workersByMonitorId.set(
                monitorRecord.id,
                monitorWorkerIds
                    .map((workerId) => explicitWorkersById.get(workerId))
                    .filter(
                        (
                            workerRecord,
                        ): workerRecord is EffectiveMonitorWorker =>
                            workerRecord !== undefined,
                    ),
            );
            continue;
        }

        workersByMonitorId.set(
            monitorRecord.id,
            monitorLocations.flatMap(
                (location) => fallbackWorkersByLocation.get(location) ?? [],
            ),
        );
    }

    return workersByMonitorId;
}

export async function getEffectiveMonitorWorkers(
    monitorRecord: MonitorWorkerAssignment,
    options: {
        activeOnly?: boolean;
        database?: QueryableDatabase;
    } = {},
) {
    const workersByMonitor = await getEffectiveWorkersForMonitors(
        [monitorRecord],
        options,
    );
    return workersByMonitor.get(monitorRecord.id) ?? [];
}

export async function getAggregateMonitorStatusesForMonitors(
    monitors: MonitorWorkerAssignment[],
    options: {
        activeMaintenanceMonitorIds?: Set<string>;
        activeOnlyWorkers?: boolean;
    } = {},
) {
    const monitorIds = monitors.map((monitorRecord) => monitorRecord.id);
    const [
        workersByMonitorId,
        latestWorkerStatuses,
        activeMaintenanceMonitorIds,
    ] = await Promise.all([
        getEffectiveWorkersForMonitors(monitors, {
            activeOnly: options.activeOnlyWorkers ?? true,
        }),
        getLatestMonitorLocationStatuses(monitorIds),
        options.activeMaintenanceMonitorIds ??
            getActiveMaintenanceMonitorIds(monitorIds),
    ]);

    const latestStatusesByMonitorId = new Map<
        string,
        Map<string, WorkerStatusSnapshot>
    >();

    for (const workerStatus of latestWorkerStatuses) {
        const statusesForMonitor =
            latestStatusesByMonitorId.get(workerStatus.monitorId) ?? new Map();
        statusesForMonitor.set(workerStatus.location, {
            status: normalizeMonitorStatus(workerStatus.status),
            timestamp: workerStatus.timestamp,
            since: workerStatus.statusSince ?? workerStatus.timestamp,
        });
        latestStatusesByMonitorId.set(
            workerStatus.monitorId,
            statusesForMonitor,
        );
    }

    const statusesByMonitorId = new Map<string, AggregateMonitorStatusResult>();
    const now = new Date();

    for (const monitorRecord of monitors) {
        const workerStatusById =
            latestStatusesByMonitorId.get(monitorRecord.id) ?? new Map();
        const reportingWorkerIds = new Set(
            getReportingWorkerIds({
                workerIds: (workersByMonitorId.get(monitorRecord.id) ?? []).map(
                    (workerRecord) => workerRecord.id,
                ),
                workerStatusById,
                at: now,
                timing: monitorRecord,
            }),
        );
        const effectiveWorkers = (
            workersByMonitorId.get(monitorRecord.id) ?? []
        ).filter((workerRecord) => reportingWorkerIds.has(workerRecord.id));
        statusesByMonitorId.set(
            monitorRecord.id,
            getAggregateMonitorStatus({
                configuredWorkerIds: effectiveWorkers.map(
                    (workerRecord) => workerRecord.id,
                ),
                workerStatusById,
                isUnderMaintenance: activeMaintenanceMonitorIds.has(
                    monitorRecord.id,
                ),
                workerLabels: new Map(
                    effectiveWorkers.map((workerRecord) => [
                        workerRecord.id,
                        `${workerRecord.name} (${workerRecord.location.toUpperCase()})`,
                    ]),
                ),
            }),
        );
    }

    return statusesByMonitorId;
}

export async function getAggregateMonitorStatusForMonitor(
    monitorRecord: MonitorWorkerAssignment,
    options: {
        activeMaintenanceMonitorIds?: Set<string>;
        activeOnlyWorkers?: boolean;
    } = {},
) {
    const statuses = await getAggregateMonitorStatusesForMonitors(
        [monitorRecord],
        options,
    );
    return (
        statuses.get(monitorRecord.id) ?? {
            status: "pending",
            lastCheck: null,
            allWorkersReporting: false,
            states: [],
            allWorkersDownSince: null,
            statusReason:
                "Waiting for enough worker reports to determine status.",
            affectedWorkerIds: [],
            downWorkerIds: [],
            upWorkerIds: [],
            pendingWorkerIds: [],
        }
    );
}
