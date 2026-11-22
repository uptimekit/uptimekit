import { describe, expect, it } from "vitest";
import {
    getAggregateMonitorStatus,
    getReportingWorkerIds,
    isAutomaticIncidentOpenEligible,
    type MonitorRuntimeStatus,
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
    const timing = { interval: 60, timeout: 30 };

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

    it("keeps a worker that reported within two intervals plus timeout", () => {
        const workerStatusById = new Map([
            ["slow", snapshot("up", "2026-04-26T10:07:30Z")],
            ["vps", snapshot("down", "2026-04-26T10:09:30Z")],
        ]);

        expect(
            getReportingWorkerIds({
                workerIds: ["slow", "vps"],
                workerStatusById,
                at: now,
                timing,
            }),
        ).toEqual(["slow", "vps"]);
    });

    it("keeps the worker sending events and falls back when none reports", () => {
        const workerStatusById = new Map([
            ["dedicated", snapshot("up", "2026-04-26T09:00:00Z")],
        ]);

        expect(
            getReportingWorkerIds({
                workerIds: ["dedicated", "vps"],
                workerStatusById,
                at: now,
                timing,
                reportingWorkerId: "vps",
            }),
        ).toEqual(["vps"]);
        expect(
            getReportingWorkerIds({
                workerIds: ["dedicated", "vps"],
                workerStatusById,
                at: now,
                timing,
            }),
        ).toEqual(["dedicated", "vps"]);
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
