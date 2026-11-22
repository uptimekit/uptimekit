import { describe, expect, it } from "vitest";
import {
    type EffectiveMonitorWorker,
    getAggregateMonitorStatus,
    getReportingWorkers,
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

    function createWorker(
        id: string,
        lastHeartbeat: Date | null,
    ): EffectiveMonitorWorker {
        return { id, name: id, location: "pl", lastHeartbeat };
    }

    it("drops workers whose heartbeat is stale", () => {
        const workers = [
            createWorker("dedicated", new Date("2026-04-26T10:00:00Z")),
            createWorker("vps", new Date("2026-04-26T10:09:30Z")),
        ];

        expect(getReportingWorkers(workers, { now }).map((w) => w.id)).toEqual([
            "vps",
        ]);
    });

    it("keeps the worker sending events even without a fresh heartbeat", () => {
        const workers = [
            createWorker("dedicated", new Date("2026-04-26T10:00:00Z")),
            createWorker("vps", null),
        ];

        expect(
            getReportingWorkers(workers, {
                now,
                reportingWorkerId: "vps",
            }).map((w) => w.id),
        ).toEqual(["vps"]);
    });

    it("falls back to every worker when none is online", () => {
        const workers = [
            createWorker("dedicated", new Date("2026-04-26T10:00:00Z")),
            createWorker("vps", null),
        ];

        expect(getReportingWorkers(workers, { now })).toEqual(workers);
    });

    it("opens an incident when the only online worker reports down", () => {
        const workers = [
            createWorker("dedicated", new Date("2026-04-26T10:00:00Z")),
            createWorker("vps", new Date("2026-04-26T10:09:30Z")),
        ];
        const workerStatusById = new Map([
            [
                "dedicated",
                {
                    status: "up" as const,
                    timestamp: new Date("2026-04-26T10:00:00Z"),
                },
            ],
            [
                "vps",
                {
                    status: "down" as const,
                    timestamp: now,
                    since: new Date("2026-04-26T10:01:00Z"),
                },
            ],
        ]);

        const result = isAutomaticIncidentOpenEligible({
            configuredWorkerIds: getReportingWorkers(workers, {
                now,
                reportingWorkerId: "vps",
            }).map((w) => w.id),
            workerStatusById,
            activeIncident: undefined,
            eventTime: now,
            incidentPendingDurationSeconds: 60,
        });

        expect(result.eligible).toBe(true);
        expect(result.startedAt?.toISOString()).toBe(
            "2026-04-26T10:01:00.000Z",
        );
    });
});
