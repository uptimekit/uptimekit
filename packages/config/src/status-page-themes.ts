export const statusPageThemeIds = [
    "default",
    "flat",
    "signal",
    "spark",
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
