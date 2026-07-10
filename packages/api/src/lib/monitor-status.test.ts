import { describe, expect, it } from "vitest";
import {
    getAggregateMonitorStatus,
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
