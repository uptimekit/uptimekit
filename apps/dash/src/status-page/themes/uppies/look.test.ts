import { describe, expect, it } from "vitest";
import type { Incident, UptimeDay } from "../types";
import { findDayIncident, parseNavLinks } from "./look";

describe("parseNavLinks", () => {
    it("reads one label | url per line", () => {
        expect(
            parseNavLinks(
                "docs | https://docs.example.com\n blog|http://blog.example.com ",
            ),
        ).toEqual([
            { label: "docs", url: "https://docs.example.com" },
            { label: "blog", url: "http://blog.example.com" },
        ]);
    });

    it("drops lines that are not http(s) links", () => {
        expect(
            parseNavLinks(
                [
                    "xss | javascript:alert(1)",
                    "data | data:text/html,hi",
                    "no url |",
                    "| https://no-label.example.com",
                    "no pipe https://example.com",
                    "relative | /status",
                ].join("\n"),
            ),
        ).toEqual([]);
    });

    it("keeps at most six links", () => {
        const raw = Array.from(
            { length: 8 },
            (_, i) => `l${i} | https://e.com/${i}`,
        ).join("\n");
        expect(parseNavLinks(raw)).toHaveLength(6);
    });
});

describe("findDayIncident", () => {
    const incident = (
        id: string,
        monitorId: string,
        startedAt: string,
        endedAt: string | null,
    ): Incident => ({
        id,
        title: id,
        status: "resolved",
        severity: "major",
        startedAt: new Date(startedAt),
        endedAt: endedAt ? new Date(endedAt) : null,
        monitors: [{ monitor: { id: monitorId, name: monitorId } }],
        activities: [],
        detailsLink: `/incidents/${id}`,
    });
    const day = (date: string): UptimeDay => ({
        date,
        status: "major_outage",
        uptime: 50,
    });
    const incidents = [
        incident("open", "api", "2026-10-22T23:00:00Z", null),
        incident(
            "other",
            "web",
            "2026-10-20T10:00:00Z",
            "2026-10-20T11:00:00Z",
        ),
        incident("past", "api", "2026-10-19T23:30:00Z", "2026-10-20T01:00:00Z"),
    ];

    it("matches incidents that overlap the day for the monitor", () => {
        expect(findDayIncident(day("2026-10-20"), "api", incidents)?.id).toBe(
            "past",
        );
        expect(findDayIncident(day("2026-10-25"), "api", incidents)?.id).toBe(
            "open",
        );
    });

    it("ignores other monitors and days without incidents", () => {
        expect(findDayIncident(day("2026-10-21"), "api", incidents)).toBe(
            undefined,
        );
        expect(findDayIncident(day("2026-10-22"), "web", incidents)).toBe(
            undefined,
        );
    });
});
