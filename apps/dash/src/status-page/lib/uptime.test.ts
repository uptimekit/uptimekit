import { describe, expect, it } from "vitest";
import {
    buildUptimeSegments,
    calculateBarSegments,
    formatTooltipDate,
    getNewestEvent,
    parseDuration,
} from "./uptime";

describe("shared uptime behavior", () => {
    it("parses and segments uptime history consistently", () => {
        expect(parseDuration("1h 5m 3s down")).toBe(3_903_000);
        expect(
            buildUptimeSegments([
                { date: "2026-08-01", status: "operational", uptime: 100 },
                { date: "2026-08-02", status: "operational", uptime: 100 },
                { date: "2026-08-03", status: "degraded", uptime: 99 },
            ]),
        ).toEqual([
            { start: 0, length: 2, status: "operational" },
            { start: 2, length: 1, status: "degraded" },
        ]);
    });

    it("uses the same stacked-bar calculation for every theme", () => {
        const segments = calculateBarSegments({
            date: "2026-08-03",
            status: "major_outage",
            uptime: 50,
            downtimeMs: 12 * 60 * 60 * 1000,
        });

        expect(segments.uptime).toBe(50);
        expect(segments.critical).toBe(50);
    });

    it("formats date-only values in UTC", () => {
        expect(formatTooltipDate("2026-08-07")).toContain("Aug 7, 2026");
    });
});

describe("getNewestEvent", () => {
    it("picks the event that started last across outages and maintenance", () => {
        expect(
            getNewestEvent([
                { id: "outage", startedAt: "2026-10-22T09:00:00Z" },
                {
                    id: "maintenance",
                    startedAt: new Date("2026-10-22T14:00:00Z"),
                },
                { id: "older", startedAt: "2026-10-21T23:00:00Z" },
            ])?.id,
        ).toBe("maintenance");
    });

    it("returns nothing for a day without events", () => {
        expect(getNewestEvent([])).toBeUndefined();
    });
});
