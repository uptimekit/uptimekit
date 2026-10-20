import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StatusPageData } from "@/status-page/themes/types";
import type { getStatusPageEvents, StatusPageRecord } from "./db-queries";

const mocks = vi.hoisted(() => ({
    getStatusPageData: vi.fn(),
    getStatusPageEvents: vi.fn(),
}));

vi.mock("./data-preparer", () => ({
    getStatusPageData: mocks.getStatusPageData,
}));

vi.mock("./db-queries", () => ({
    getStatusPageEvents: mocks.getStatusPageEvents,
}));

import {
    buildStatusPageSummary,
    renderStatusSummary,
    statusSummaryNotFound,
    statusSummaryPreflight,
} from "./status-summary";

type StatusPageEvents = Awaited<ReturnType<typeof getStatusPageEvents>>;
type Report = StatusPageEvents["reports"][number];
type Maintenance = StatusPageEvents["maintenances"][number];

const now = new Date("2026-10-20T19:00:00Z");
const hoursAgo = (hours: number) =>
    new Date(now.getTime() - hours * 60 * 60 * 1000);

const data = {
    config: { id: "page-1", name: "MSCode", slug: "mscode" },
    overallStatus: "partial_outage",
    lastUpdated: now.toISOString(),
    monitorGroups: [
        {
            group: null,
            monitors: [
                { id: "api", name: "API", currentStatus: "major_outage" },
            ],
        },
        {
            group: { id: "group-1", name: "Storefront" },
            monitors: [
                { id: "web", name: "Web", currentStatus: "operational" },
                { id: "cdn", name: "CDN", currentStatus: "unknown" },
            ],
        },
    ],
} as unknown as StatusPageData;

function report(overrides: Partial<Report>): Report {
    return {
        id: "incident",
        title: "Incident",
        status: "investigating",
        severity: "major",
        description: null,
        startedAt: hoursAgo(1),
        plannedEndAt: null,
        endedAt: null,
        createdAt: hoursAgo(1),
        monitors: [],
        activities: [],
        affectedMonitors: [],
        updates: [],
        ...overrides,
    } as Report;
}

function maintenance(overrides: Partial<Maintenance>): Maintenance {
    return {
        ...report({ severity: "maintenance", status: "scheduled" }),
        startAt: hoursAgo(1),
        endAt: null,
        monitors: [],
        ...overrides,
    } as Maintenance;
}

const internalMonitor = { id: "internal", name: "Internal" };
const apiMonitor = { id: "api", name: "API" };

const events: StatusPageEvents = {
    reports: [
        report({
            id: "active",
            title: "API errors",
            severity: "critical",
            startedAt: hoursAgo(2),
            affectedMonitors: [
                { monitorId: "api", monitor: apiMonitor },
                { monitorId: "internal", monitor: internalMonitor },
            ],
            updates: [
                {
                    id: "update-2",
                    message: "Fix deployed",
                    type: "update",
                    createdAt: hoursAgo(0.5),
                },
                {
                    id: "update-1",
                    message: "Investigating",
                    type: "update",
                    createdAt: hoursAgo(2),
                },
            ],
        }),
        report({
            id: "recently-resolved",
            status: "resolved",
            startedAt: hoursAgo(30),
            endedAt: hoursAgo(20),
        }),
        report({
            id: "old",
            status: "resolved",
            startedAt: hoursAgo(50),
            endedAt: hoursAgo(25),
        }),
    ],
    maintenances: [
        maintenance({
            id: "upcoming",
            title: "Database upgrade",
            description: "Short downtime",
            startedAt: new Date("2026-10-20T20:00:00Z"),
            plannedEndAt: new Date("2026-10-20T21:00:00Z"),
            monitors: [
                { monitorId: "web", monitor: { id: "web", name: "Web" } },
            ],
        }),
        maintenance({
            id: "running",
            startedAt: hoursAgo(1),
            plannedEndAt: hoursAgo(-1),
        }),
        maintenance({
            id: "finished-recently",
            startedAt: hoursAgo(5),
            plannedEndAt: hoursAgo(3),
        }),
        maintenance({
            id: "finished-long-ago",
            startedAt: hoursAgo(40),
            plannedEndAt: hoursAgo(30),
        }),
    ],
};

function buildSummary(routeSlug?: string) {
    return buildStatusPageSummary({
        data,
        events,
        origin: "https://status.example.com",
        routeSlug,
        now,
    });
}

describe("buildStatusPageSummary", () => {
    it("maps page and component statuses", () => {
        const summary = buildSummary();

        expect(summary.page).toEqual({
            id: "page-1",
            name: "MSCode",
            url: "https://status.example.com/",
        });
        expect(summary.status).toBe("outage");
        expect(summary.updatedAt).toBe(now.toISOString());
        expect(summary.components).toEqual([
            { id: "api", name: "API", group: null, status: "down" },
            { id: "web", name: "Web", group: "Storefront", status: "up" },
            { id: "cdn", name: "CDN", group: "Storefront", status: "pending" },
        ]);
    });

    it("reports unknown page health instead of operational", () => {
        const summary = buildStatusPageSummary({
            data: { ...data, overallStatus: "unknown", monitorGroups: [] },
            events: { reports: [], maintenances: [] },
            origin: "https://status.example.com",
            now,
        });

        expect(summary.status).toBe("unknown");
        expect(summary.components).toEqual([]);
    });

    it("serializes incidents without leaking monitors outside the page", () => {
        const [incident] = buildSummary().incidents;

        expect(incident).toEqual({
            id: "active",
            title: "API errors",
            status: "investigating",
            severity: "critical",
            startedAt: hoursAgo(2).toISOString(),
            updatedAt: hoursAgo(0.5).toISOString(),
            resolvedAt: null,
            url: "https://status.example.com/incidents/active",
            componentIds: ["api"],
            latestUpdate: {
                message: "Fix deployed",
                createdAt: hoursAgo(0.5).toISOString(),
            },
        });
    });

    it("keeps active items and those finished within the last 24 hours", () => {
        const summary = buildSummary();

        expect(summary.incidents.map(({ id }) => id)).toEqual([
            "active",
            "recently-resolved",
        ]);
        expect(summary.incidents[1]?.resolvedAt).toBe(
            hoursAgo(20).toISOString(),
        );
        expect(
            summary.maintenances.map(({ id, status }) => [id, status]),
        ).toEqual([
            ["upcoming", "scheduled"],
            ["running", "in_progress"],
            ["finished-recently", "completed"],
        ]);
    });

    it("serializes maintenance windows", () => {
        expect(buildSummary("mscode").maintenances[0]).toEqual({
            id: "upcoming",
            title: "Database upgrade",
            description: "Short downtime",
            status: "scheduled",
            startAt: "2026-10-20T20:00:00.000Z",
            endAt: "2026-10-20T21:00:00.000Z",
            url: "https://status.example.com/status/mscode/incidents/upcoming",
            componentIds: ["web"],
        });
    });
});

describe("renderStatusSummary", () => {
    const request = new Request("https://status.example.com/summary.json", {
        headers: { host: "status.example.com" },
    });
    const pageConfig = {
        id: "page-1",
        public: true,
        password: null,
    } as StatusPageRecord;

    beforeEach(() => {
        mocks.getStatusPageData.mockReset().mockResolvedValue(data);
        mocks.getStatusPageEvents.mockReset().mockResolvedValue(events);
    });

    it("returns public JSON with CORS and cache headers", async () => {
        const response = await renderStatusSummary({ request, pageConfig });

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain(
            "application/json",
        );
        expect(response.headers.get("access-control-allow-origin")).toBe("*");
        expect(response.headers.get("cache-control")).toBe(
            "public, max-age=30, stale-while-revalidate=60",
        );
        expect(await response.json()).toMatchObject({
            page: { id: "page-1" },
            status: "outage",
        });
    });

    it("does not expose password-protected pages", async () => {
        const response = await renderStatusSummary({
            request,
            pageConfig: {
                ...pageConfig,
                id: "private-page",
                public: false,
                password: "hash",
            },
        });

        expect(response.status).toBe(404);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.json()).toEqual({ error: "Not found" });
        expect(mocks.getStatusPageData).not.toHaveBeenCalled();
        expect(mocks.getStatusPageEvents).not.toHaveBeenCalled();
    });
});

describe("status summary responses", () => {
    it("keeps not found readable cross-origin", () => {
        const response = statusSummaryNotFound();

        expect(response.status).toBe(404);
        expect(response.headers.get("access-control-allow-origin")).toBe("*");
    });

    it("answers CORS preflight requests", () => {
        const response = statusSummaryPreflight();

        expect(response.status).toBe(204);
        expect(response.headers.get("access-control-allow-origin")).toBe("*");
        expect(response.headers.get("access-control-allow-methods")).toBe(
            "GET, OPTIONS",
        );
    });
});
