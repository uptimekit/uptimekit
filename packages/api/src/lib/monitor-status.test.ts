import { describe, expect, it } from "vitest";
import {
    getAggregateMonitorStatus,
    getReportingWorkerIds,
    getWorkerStatusSince,
    isAutomaticIncidentOpenEligible,
    type MonitorRuntimeStatus,
    type WorkerStatusSnapshot,
} from "./monitor-status";

function toMap(
    entries: Array<[string, { status: MonitorRuntimeStatus; timestamp: Date }]>,
) {
    return new Map(entries);
}

describe("aggregate monitor status", () => {
    it("marks a monitor down only when every configured worker is down", () => {
        const result = getAggregateMonitorStatus({
            configuredWorkerIds: ["worker-a", "worker-b"],
            workerStatusById: toMap([
                [
                    "worker-a",
                    {
                        status: "down",
                        timestamp: new Date("2026-04-26T10:00:00Z"),
                    },
                ],
                [
                    "worker-b",
                    {
                        status: "down",
                        timestamp: new Date("2026-04-26T10:00:05Z"),
                    },
                ],
            ]),
        });

        expect(result.status).toBe("down");
        expect(result.allWorkersDownSince?.toISOString()).toBe(
            "2026-04-26T10:00:05.000Z",
        );
        expect(result.lastCheck?.toISOString()).toBe(
            "2026-04-26T10:00:05.000Z",
        );
    });

    it("marks partial regional failure as degraded", () => {
        const result = getAggregateMonitorStatus({
            configuredWorkerIds: ["worker-a", "worker-b"],
            workerStatusById: toMap([
                [
                    "worker-a",
                    {
                        status: "down",
                        timestamp: new Date("2026-04-26T10:00:00Z"),
                    },
                ],
                [
                    "worker-b",
                    {
                        status: "up",
                        timestamp: new Date("2026-04-26T10:00:00Z"),
                    },
                ],
            ]),
        });

        expect(result.status).toBe("degraded");
        expect(result.allWorkersDownSince).toBeNull();
        expect(result.statusReason).toBe(
            "worker-a is reporting down while worker-b is reporting up.",
        );
        expect(result.affectedWorkerIds).toEqual(["worker-a"]);
    });

    it("stays pending until all configured workers have reported", () => {
        const result = getAggregateMonitorStatus({
            configuredWorkerIds: ["worker-a", "worker-b"],
            workerStatusById: toMap([
                [
                    "worker-a",
                    {
                        status: "down",
                        timestamp: new Date("2026-04-26T10:00:00Z"),
                    },
                ],
            ]),
        });

        expect(result.status).toBe("pending");
        expect(result.allWorkersReporting).toBe(false);
    });

    it("uses maintenance as the effective status when maintenance is active", () => {
        const result = getAggregateMonitorStatus({
            configuredWorkerIds: ["worker-a"],
            workerStatusById: toMap([
                [
                    "worker-a",
                    {
                        status: "down",
                        timestamp: new Date("2026-04-26T10:00:00Z"),
                    },
                ],
            ]),
            isUnderMaintenance: true,
        });

        expect(result.status).toBe("maintenance");
    });
});

describe("reporting workers", () => {
    const now = new Date("2026-04-26T10:10:00Z");
    // Window: 60 + 3 * 30 + 2 * 20 + 30 = 220 seconds.
    const timing = { interval: 60, timeout: 30, retries: 2, retryInterval: 20 };

    function snapshot(
        status: MonitorRuntimeStatus,
        timestamp: string,
        since?: string,
    ) {
        return {
            status,
            timestamp: new Date(timestamp),
            since: since ? new Date(since) : undefined,
        };
    }

    it("drops a worker that stopped reporting on the monitor", () => {
        const workerStatusById = new Map([
            ["dedicated", snapshot("up", "2026-04-26T10:06:00Z")],
            ["vps", snapshot("down", "2026-04-26T10:09:30Z")],
        ]);

        expect(
            getReportingWorkerIds({
                workerIds: ["dedicated", "vps"],
                workerStatusById,
                at: now,
                timing,
            }),
        ).toEqual(["vps"]);
    });

    it("keeps a worker that is still finishing its retries", () => {
        const workerStatusById = new Map([
            ["retrying", snapshot("up", "2026-04-26T10:06:30Z")],
            ["vps", snapshot("down", "2026-04-26T10:09:30Z")],
        ]);

        expect(
            getReportingWorkerIds({
                workerIds: ["retrying", "vps"],
                workerStatusById,
                at: now,
                timing,
            }),
        ).toEqual(["retrying", "vps"]);
    });

    it("stays pending until a new worker sends its first report", () => {
        const workerStatusById = new Map([
            ["vps", snapshot("down", "2026-04-26T10:09:30Z")],
        ]);
        const reportingWorkerIds = getReportingWorkerIds({
            workerIds: ["new", "vps"],
            workerStatusById,
            at: now,
            timing,
            reportingWorkerId: "vps",
        });

        expect(reportingWorkerIds).toEqual(["new", "vps"]);
        expect(
            getAggregateMonitorStatus({
                configuredWorkerIds: reportingWorkerIds,
                workerStatusById,
            }).status,
        ).toBe("pending");
    });

    it("keeps the worker sending events and falls back when none reports", () => {
        const workerStatusById = new Map([
            ["dedicated", snapshot("up", "2026-04-26T09:00:00Z")],
            ["vps", snapshot("up", "2026-04-26T09:00:00Z")],
        ]);
        const input = {
            workerIds: ["dedicated", "vps"],
            workerStatusById,
            at: now,
            timing,
        };

        expect(
            getReportingWorkerIds({ ...input, reportingWorkerId: "vps" }),
        ).toEqual(["vps"]);
        expect(getReportingWorkerIds(input)).toEqual(["dedicated", "vps"]);
    });

    it("opens an incident from the outage start once the dead worker drops out", () => {
        const workerStatusById = new Map([
            ["dedicated", snapshot("up", "2026-04-26T10:01:00Z")],
            [
                "vps",
                snapshot(
                    "down",
                    "2026-04-26T10:10:00Z",
                    "2026-04-26T10:01:30Z",
                ),
            ],
        ]);

        const result = isAutomaticIncidentOpenEligible({
            configuredWorkerIds: getReportingWorkerIds({
                workerIds: ["dedicated", "vps"],
                workerStatusById,
                at: now,
                timing,
                reportingWorkerId: "vps",
            }),
            workerStatusById,
            activeIncident: undefined,
            eventTime: now,
            incidentPendingDurationSeconds: 60,
        });

        expect(result.eligible).toBe(true);
        expect(result.startedAt?.toISOString()).toBe(
            "2026-04-26T10:01:30.000Z",
        );
    });
});

describe("worker status since", () => {
    // Window: 60 + 3 * 30 + 2 * 20 + 30 = 220 seconds.
    const timing = { interval: 60, timeout: 30, retries: 2, retryInterval: 20 };
    const previous = {
        status: "down" as const,
        timestamp: new Date("2026-04-26T10:01:00Z"),
        since: new Date("2026-04-26T10:00:00Z"),
    };

    it("starts a new streak when the status changes", () => {
        const at = new Date("2026-04-26T10:02:00Z");
        expect(
            getWorkerStatusSince({ previous, status: "up", at, timing }),
        ).toBe(at);
    });

    it("keeps the streak while the worker keeps reporting", () => {
        expect(
            getWorkerStatusSince({
                previous,
                status: "down",
                at: new Date("2026-04-26T10:04:40Z"),
                timing,
            }),
        ).toBe(previous.since);
    });

    it("does not reopen an incident from a resolved outage after a reporting gap", () => {
        const returnedAt = new Date("2026-04-26T11:00:00Z");
        const workerStatusById = new Map<string, WorkerStatusSnapshot>([
            ["worker-b", { status: "up", timestamp: previous.timestamp }],
            [
                "worker-a",
                {
                    status: "down",
                    timestamp: returnedAt,
                    since: getWorkerStatusSince({
                        previous,
                        status: "down",
                        at: returnedAt,
                        timing,
                    }),
                },
            ],
        ]);
        const evaluate = (eventTime: Date) =>
            isAutomaticIncidentOpenEligible({
                configuredWorkerIds: getReportingWorkerIds({
                    workerIds: ["worker-a", "worker-b"],
                    workerStatusById,
                    at: eventTime,
                    timing,
                    reportingWorkerId: "worker-a",
                }),
                workerStatusById,
                activeIncident: undefined,
                eventTime,
                incidentPendingDurationSeconds: 60,
            });

        expect(evaluate(returnedAt).eligible).toBe(false);
        expect(
            evaluate(new Date("2026-04-26T11:01:00Z")).startedAt?.toISOString(),
        ).toBe(returnedAt.toISOString());
    });

    it("does not reach back past the last recovery for a delayed report", () => {
        // A's 10:01 report was queued, so B resolved the incident at 10:04
        // while A was excluded; the late report keeps A's 10:00 streak.
        const recoveredAt = new Date("2026-04-26T10:04:00Z");
        const workerStatusById = new Map<string, WorkerStatusSnapshot>([
            ["worker-b", { status: "up", timestamp: recoveredAt }],
            [
                "worker-a",
                {
                    status: "down",
                    timestamp: new Date("2026-04-26T10:07:30Z"),
                    since: previous.since,
                },
            ],
        ]);
        const evaluate = (eventTime: Date) =>
            isAutomaticIncidentOpenEligible({
                configuredWorkerIds: getReportingWorkerIds({
                    workerIds: ["worker-a", "worker-b"],
                    workerStatusById,
                    at: eventTime,
                    timing,
                    reportingWorkerId: "worker-a",
                }),
                workerStatusById,
                activeIncident: undefined,
                eventTime,
                incidentPendingDurationSeconds: 300,
                lastRecoveredAt: recoveredAt,
            });

        expect(evaluate(new Date("2026-04-26T10:08:00Z")).eligible).toBe(false);
        expect(
            evaluate(new Date("2026-04-26T10:09:00Z")).startedAt?.toISOString(),
        ).toBe(recoveredAt.toISOString());
    });

    it("does not reopen a resolved outage from reports older than the recovery", () => {
        const eventTime = new Date("2026-04-26T10:01:00Z");
        const result = isAutomaticIncidentOpenEligible({
            configuredWorkerIds: ["worker-a"],
            workerStatusById: new Map([
                ["worker-a", { ...previous, timestamp: eventTime }],
            ]),
            activeIncident: undefined,
            eventTime,
            incidentPendingDurationSeconds: 60,
            lastRecoveredAt: new Date("2026-04-26T10:05:00Z"),
        });

        expect(result.eligible).toBe(false);
    });
});
