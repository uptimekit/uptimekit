import { describe, expect, it } from "vitest";
import { parseWorkerEvents } from "./event-validation";

const valid = {
    monitorId: "m1",
    status: "up",
    latency: 12,
    timestamp: "2026-01-01T00:00:00.123Z",
};

describe("parseWorkerEvents", () => {
    it("keeps valid events and drops malformed ones", () => {
        const { events, rejected } = parseWorkerEvents(
            [
                valid,
                { ...valid, timestamp: "not-a-date" },
                { ...valid, status: "exploded" },
                { ...valid, latency: -1 },
                { ...valid, timestamp: "9999-12-31T23:59:59Z" },
                null,
            ],
            "worker-1",
        );

        expect(events).toHaveLength(1);
        expect(rejected).toBe(5);
    });

    it("attributes events to the authenticated worker", () => {
        const { events } = parseWorkerEvents(
            [{ ...valid, location: "someone-else" }],
            "worker-1",
        );

        expect(events[0]?.location).toBe("worker-1");
    });

    it("truncates oversized error messages", () => {
        const { events } = parseWorkerEvents(
            [{ ...valid, status: "down", error: "x".repeat(10_000) }],
            "worker-1",
        );

        expect(events[0]?.error).toHaveLength(2_000);
    });
});
