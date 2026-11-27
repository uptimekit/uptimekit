export const statusPageThemeIds = [
    "default",
    "flat",
    "signal",
    "spark",
    "dashboard",
    "uppies",
] as const;

export type StatusPageThemeId = (typeof statusPageThemeIds)[number];

export type StatusPageBarStyle = "normal" | "length" | "signal";

export interface StatusPageThemeCapabilities {
    headerLayout: boolean;
    barStyles: readonly StatusPageBarStyle[];
    groupCollapse: boolean;
    activeIssues: boolean;
    scheduledMaintenance: boolean;
    incidentHistory: boolean;
    websiteLink: boolean;
    lookOptions: boolean;
}

export interface StatusPageThemeDefinition {
    id: StatusPageThemeId;
    name: string;
    description: string;
    supportsDarkMode: boolean;
    capabilities: StatusPageThemeCapabilities;
}

const completeCapabilities = {
    headerLayout: true,
    barStyles: ["normal", "length", "signal"],
    groupCollapse: true,
    activeIssues: true,
    scheduledMaintenance: true,
    incidentHistory: true,
    websiteLink: true,
    lookOptions: false,
} as const satisfies StatusPageThemeCapabilities;

export const statusPageThemes = [
    {
        id: "default",
        name: "Default",
        description: "Classic design with detailed uptime history",
        supportsDarkMode: true,
        capabilities: completeCapabilities,
    },
    {
        id: "flat",
        name: "Flat",
        description: "Simple, compact design without decorative shadows",
        supportsDarkMode: true,
        capabilities: completeCapabilities,
    },
    {
        id: "signal",
        name: "Signal",
        description: "Compact operational dashboard with hierarchical services",
        supportsDarkMode: true,
        capabilities: {
            ...completeCapabilities,
            headerLayout: false,
            barStyles: ["signal"],
        },
    },
    {
        id: "spark",
        name: "Spark",
        description: "Incident-focused dashboard with calendar history",
        supportsDarkMode: true,
        capabilities: {
            ...completeCapabilities,
            headerLayout: false,
            barStyles: ["normal"],
        },
    },
    {
        id: "dashboard",
        name: "Dashboard",
        description:
            "Console-style dashboard layout matching the UptimeKit console",
        supportsDarkMode: true,
        capabilities: completeCapabilities,
    },
    {
        id: "uppies",
        name: "Uppies",
        description:
            "Quiet, configurable page ported from uppies by ryana may que",
        supportsDarkMode: true,
        capabilities: {
            ...completeCapabilities,
            headerLayout: false,
            barStyles: ["normal"],
            groupCollapse: false,
            lookOptions: true,
        },
    },
] as const satisfies readonly StatusPageThemeDefinition[];

export const defaultStatusPageThemeId: StatusPageThemeId = "default";

export function isStatusPageThemeId(
    value: unknown,
): value is StatusPageThemeId {
    return statusPageThemeIds.includes(value as StatusPageThemeId);
}

export function normalizeStatusPageThemeId(value: unknown): StatusPageThemeId {
    return isStatusPageThemeId(value) ? value : defaultStatusPageThemeId;
}

export function getStatusPageThemeDefinition(
    themeId: StatusPageThemeId,
): StatusPageThemeDefinition {
    const definition = statusPageThemes.find((theme) => theme.id === themeId);
    if (!definition) {
        throw new Error(`Unknown status page theme: ${themeId}`);
    }
    return definition;
}

// The look options copied from uppies (github.com/schmayterling/uppies).
export const uppiesAccentSwatches = [25, 55, 85, 150, 200, 245, 290, 330];
export const uppiesSurfaces = ["neutral", "paper"] as const;
export const uppiesCorners = ["sharp", "soft", "round"] as const;
export const uppiesFonts = ["system", "rounded", "serif", "mono"] as const;
export const uppiesAnnouncementColors = [
    "blue",
    "green",
    "amber",
    "red",
    "neutral",
    "accent",
] as const;

export interface UppiesLook {
    accentHue: number;
    surface: (typeof uppiesSurfaces)[number];
    corners: (typeof uppiesCorners)[number];
    font: (typeof uppiesFonts)[number];
    showStatusIcon: boolean;
    tagline: string;
    footerText: string;
    announcement: string;
    announcementColor: (typeof uppiesAnnouncementColors)[number];
    // One "label | https://url" per line, shown in the top bar.
    navLinks: string;
}

export const defaultUppiesLook: UppiesLook = {
    accentHue: 200,
    surface: "neutral",
    corners: "soft",
    font: "system",
    showStatusIcon: true,
    tagline: "",
    footerText: "",
    announcement: "",
    announcementColor: "blue",
    navLinks: "",
};
