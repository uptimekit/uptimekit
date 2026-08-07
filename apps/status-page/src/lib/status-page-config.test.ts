import {
    getStatusPageThemeDefinition,
    statusPageThemeIds,
    statusPageThemes,
} from "@uptimekit/config/status-page-themes";
import { describe, expect, it } from "vitest";
import {
    normalizeStatusPageDesign,
    prepareStatusPageConfig,
} from "./status-page-config";

describe("status page design normalization", () => {
    it("keeps one complete capability contract for every registered theme", () => {
        expect(statusPageThemes.map(({ id }) => id)).toEqual(
            statusPageThemeIds,
        );

        for (const theme of statusPageThemes) {
            expect(getStatusPageThemeDefinition(theme.id)).toBe(theme);
            expect(theme.capabilities.barStyles.length).toBeGreaterThan(0);
            expect(theme.capabilities).toMatchObject({
                groupCollapse: true,
                activeIssues: true,
                scheduledMaintenance: true,
                incidentHistory: true,
                websiteLink: true,
            });
        }
    });

    it("falls back to a complete safe design", () => {
        expect(normalizeStatusPageDesign({ themeId: "missing" })).toEqual({
            themeId: "default",
            theme: "light",
            logoUrl: undefined,
            faviconUrl: undefined,
            websiteUrl: undefined,
            contactUrl: undefined,
            customCss: "",
            headerLayout: "vertical",
            barStyle: "normal",
            barDays: 90,
            percentDigits: 2,
            defaultSectionCollapsible: true,
            defaultSectionCollapsed: false,
            allowSubscriptions: true,
        });
    });

    it("preserves supported settings on every public page config", () => {
        const config = prepareStatusPageConfig(
            {
                id: "page-1",
                name: "Example",
                slug: "example",
                design: {
                    themeId: "signal",
                    theme: "dark",
                    websiteUrl: "https://example.com",
                    headerLayout: "horizontal",
                    barStyle: "signal",
                    barDays: 30,
                    percentDigits: 4,
                    defaultSectionCollapsed: true,
                    allowSubscriptions: false,
                },
            },
            "example",
        );

        expect(config.routeSlug).toBe("example");
        expect(config.design).toMatchObject({
            themeId: "signal",
            theme: "dark",
            websiteUrl: "https://example.com",
            headerLayout: "horizontal",
            barStyle: "signal",
            barDays: 30,
            percentDigits: 4,
            defaultSectionCollapsed: true,
            allowSubscriptions: false,
        });
    });
});
