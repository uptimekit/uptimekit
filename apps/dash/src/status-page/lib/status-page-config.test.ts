import {
    defaultUppiesLook,
    getStatusPageThemeDefinition,
    statusPageThemeIds,
    statusPageThemes,
} from "@uptimekit/config/status-page-themes";
import { describe, expect, it } from "vitest";
import {
    normalizeStatusPageDesign,
    normalizeUppiesLook,
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
            uppies: defaultUppiesLook,
        });
    });

    it("keeps valid uppies look choices and replaces invalid ones", () => {
        expect(
            normalizeUppiesLook({
                accentHue: 290,
                surface: "paper",
                corners: "round",
                font: "mono",
                showStatusIcon: false,
                tagline: "hi",
                announcementColor: "red",
                navLinks: "docs | https://docs.example.com",
            }),
        ).toEqual({
            ...defaultUppiesLook,
            accentHue: 290,
            surface: "paper",
            corners: "round",
            font: "mono",
            showStatusIcon: false,
            tagline: "hi",
            announcementColor: "red",
            navLinks: "docs | https://docs.example.com",
        });

        expect(
            normalizeUppiesLook({
                accentHue: 999,
                surface: "glass",
                corners: 3,
                font: "comic",
                tagline: 42,
                announcementColor: "pink",
            }),
        ).toEqual(defaultUppiesLook);
    });

    it("keeps the system color mode and falls back to light for unknown values", () => {
        expect(normalizeStatusPageDesign({ theme: "system" }).theme).toBe(
            "system",
        );
        expect(normalizeStatusPageDesign({ theme: "sepia" }).theme).toBe(
            "light",
        );
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
