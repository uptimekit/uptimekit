import { statusPageThemeIds } from "@uptimekit/config/status-page-themes";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
    loadIncidentDetailComponent,
    loadThemeComponent,
    loadUpdatesComponent,
} from "@/status-page/lib/theme-loader";
import type { Incident, StatusPageConfig, StatusPageData } from "./types";

const incident: Incident = {
    id: "incident-1",
    title: "API latency",
    status: "investigating",
    severity: "minor",
    startedAt: new Date("2026-08-07T00:00:00Z"),
    endedAt: null,
    monitors: [],
    activities: [],
    detailsLink: "/incidents/incident-1",
};

function getConfig(
    themeId: (typeof statusPageThemeIds)[number],
): StatusPageConfig {
    return {
        id: "page-1",
        name: "Example Status",
        slug: "example",
        design: {
            themeId,
            theme: "light",
            customCss: "",
            headerLayout: "vertical",
            barStyle: themeId === "signal" ? "signal" : "normal",
            barDays: 30,
            percentDigits: 2,
            defaultSectionCollapsible: true,
            defaultSectionCollapsed: false,
            allowSubscriptions: false,
        },
    };
}

describe("theme runtime contract", () => {
    for (const themeId of statusPageThemeIds) {
        it(`${themeId} loads and renders every public page type`, async () => {
            const config = getConfig(themeId);
            const data: StatusPageData = {
                config,
                overallStatus: "degraded",
                monitorGroups: [],
                activeIssues: [incident],
                scheduledMaintenances: [],
                pastIncidents: { "Aug 7, 2026": [incident] },
                lastUpdated: "2026-08-07T00:00:00Z",
            };
            const [Home, IncidentPage, UpdatesPage] = await Promise.all([
                loadThemeComponent(themeId),
                loadIncidentDetailComponent(themeId),
                loadUpdatesComponent(themeId),
            ]);

            const home = renderToStaticMarkup(createElement(Home, { data }));
            const detail = renderToStaticMarkup(
                createElement(IncidentPage, {
                    data: { config, incident, activeIssues: [] },
                }),
            );
            const updates = renderToStaticMarkup(
                createElement(UpdatesPage, {
                    data: {
                        config,
                        allUpdates: [incident],
                        incidentsByDate: { "August 7, 2026": [incident] },
                        activeIssues: [],
                        selectedPeriod: "all",
                    },
                }),
            );

            expect(home).toContain("Example Status");
            expect(detail).toContain("API latency");
            expect(updates.toLowerCase()).toContain("incident history");
        });
    }
});
