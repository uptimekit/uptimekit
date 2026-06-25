import { describe, expect, it } from "vitest";
import {
    getWorkerAvailabilityStatus,
    getWorkerHeartbeatThreshold,
    isWorkerHeartbeatFresh,
    WORKER_HEARTBEAT_TIMEOUT_MS,
} from "../lib/worker-status";

const now = new Date("2026-05-23T12:00:00.000Z");

describe("worker status", () => {
    it("treats active workers with fresh heartbeats as online", () => {
        const lastHeartbeat = new Date(
            now.getTime() - WORKER_HEARTBEAT_TIMEOUT_MS,
        );

        expect(
            getWorkerAvailabilityStatus({
                active: true,
                lastHeartbeat,
                now,
            }),
        ).toBe("online");
    });

    it("treats stale heartbeats as offline", () => {
        const lastHeartbeat = new Date(
            now.getTime() - WORKER_HEARTBEAT_TIMEOUT_MS - 1,
        );

        expect(
            getWorkerAvailabilityStatus({
                active: true,
                lastHeartbeat,
                now,
            }),
        ).toBe("offline");
    });

    it("keeps workers without a heartbeat unknown", () => {
        expect(
            getWorkerAvailabilityStatus({
                active: true,
                lastHeartbeat: null,
                now,
            }),
        ).toBe("unknown");
    });

    it("treats inactive workers with heartbeats as offline", () => {
        expect(
            getWorkerAvailabilityStatus({
                active: false,
                lastHeartbeat: now,
                now,
            }),
        ).toBe("offline");
    });

    it("builds the database heartbeat threshold from the timeout", () => {
        expect(getWorkerHeartbeatThreshold(now).toISOString()).toBe(
            "2026-05-23T11:55:00.000Z",
        );
    });

    it("rejects invalid heartbeat values", () => {
        expect(isWorkerHeartbeatFresh("not-a-date", now)).toBe(false);
        expect(
            getWorkerAvailabilityStatus({
                active: true,
                lastHeartbeat: "not-a-date",
                now,
            }),
        ).toBe("unknown");
    });
});
