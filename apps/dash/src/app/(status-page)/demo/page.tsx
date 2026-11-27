import { loadThemeComponent } from "@/status-page/lib/theme-loader";
import { normalizeStatusPageThemeId } from "@/status-page/themes";
import { ThemePageWrapper } from "@/status-page/themes/theme-page-wrapper";
import type {
    Monitor,
    StatusPageData,
    StatusType,
    UptimeDay,
} from "@/status-page/themes/types";

// TODO: demo-only route for the linked status pages section; delete before merging

function buildHistory(badDays: Record<number, StatusType> = {}): UptimeDay[] {
    return Array.from({ length: 90 }, (_, index) => {
        const date = new Date(Date.UTC(2026, 7, 24 + index));
        const status = badDays[index] ?? "operational";
        return {
            date: date.toISOString().slice(0, 10),
            status,
            uptime: status === "operational" ? 100 : 97.5,
        };
    });
}

function buildMonitor(
    name: string,
    avgUptime: number,
    badDays?: Record<number, StatusType>,
): Monitor {
    return {
        id: name.toLowerCase(),
        name,
        currentStatus: "operational",
        avgUptime,
        history: buildHistory(badDays),
        displayStyle: "history",
    };
}

function buildDemoData(
    themeId: ReturnType<typeof normalizeStatusPageThemeId>,
    theme: "light" | "dark",
): StatusPageData {
    return {
        config: {
            id: "demo",
            name: "Acme API",
            slug: "demo",
            design: {
                themeId,
                theme,
                customCss: "",
                headerLayout: "vertical",
                barStyle: themeId === "signal" ? "signal" : "normal",
                barDays: 90,
                percentDigits: 2,
                defaultSectionCollapsible: true,
                defaultSectionCollapsed: false,
                allowSubscriptions: false,
            },
        },
        overallStatus: "operational",
        monitorGroups: [
            {
                group: {
                    id: "core",
                    name: "Core API",
                    order: 0,
                    collapsible: true,
                    defaultCollapsed: false,
                },
                monitors: [
                    buildMonitor("REST API", 99.98, {
                        71: "degraded",
                        82: "major_outage",
                    }),
                    buildMonitor("GraphQL", 100),
                    buildMonitor("Webhooks", 99.91, { 40: "degraded" }),
                ],
            },
        ],
        linkedPages: [
            {
                id: "dashboard",
                name: "Acme Dashboard",
                url: "https://status.acme.com/dashboard",
                status: "operational",
            },
            {
                id: "payments",
                name: "Payments",
                url: "https://payments-status.acme.com",
                status: "degraded",
            },
            {
                id: "eu",
                name: "EU Region",
                url: "https://status.uptimekit.dev/acme-eu",
                status: "maintenance",
            },
            {
                id: "internal",
                name: "Internal Tools",
                url: "https://status.uptimekit.dev/acme-internal",
                status: null,
            },
        ],
        activeIssues: [],
        scheduledMaintenances: [],
        pastIncidents: {},
        lastUpdated: new Date().toISOString(),
    };
}

export default async function LinkedPagesDemo({
    searchParams,
}: {
    searchParams: Promise<{ mode?: string; theme?: string }>;
}) {
    const { mode, theme: themeParam } = await searchParams;
    const themeId = normalizeStatusPageThemeId(themeParam);
    const theme = mode === "dark" ? "dark" : "light";
    const ThemePage = await loadThemeComponent(themeId);

    return (
        <ThemePageWrapper
            themeId={themeId}
            theme={theme}
            ThemeComponent={ThemePage}
            componentProps={{ data: buildDemoData(themeId, theme) }}
        />
    );
}
