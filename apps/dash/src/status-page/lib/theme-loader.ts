import {
    normalizeStatusPageThemeId,
    type StatusPageThemeId,
} from "@uptimekit/config/status-page-themes";
import type { ComponentType } from "react";
import type {
    ThemeIncidentDetailProps,
    ThemePageProps,
    ThemeUpdatesProps,
} from "@/status-page/themes/types";

interface ThemeRuntime {
    page: () => Promise<{ default: ComponentType<ThemePageProps> }>;
    incident: () => Promise<{
        default: ComponentType<ThemeIncidentDetailProps>;
    }>;
    updates: () => Promise<{ default: ComponentType<ThemeUpdatesProps> }>;
}

const themeRuntimes: Record<StatusPageThemeId, ThemeRuntime> = {
    default: {
        page: () => import("@/status-page/themes/default/theme-page"),
        incident: () => import("@/status-page/themes/default/incident-detail"),
        updates: () => import("@/status-page/themes/default/updates"),
    },
    flat: {
        page: () => import("@/status-page/themes/flat/theme-page"),
        incident: () => import("@/status-page/themes/flat/incident-detail"),
        updates: () => import("@/status-page/themes/flat/updates"),
    },
    signal: {
        page: () => import("@/status-page/themes/signal/theme-page"),
        incident: () => import("@/status-page/themes/signal/incident-detail"),
        updates: () => import("@/status-page/themes/signal/updates"),
    },
    spark: {
        page: () => import("@/status-page/themes/spark/theme-page"),
        incident: () => import("@/status-page/themes/spark/incident-detail"),
        updates: () => import("@/status-page/themes/spark/updates"),
    },
};

export async function loadThemeComponent(
    themeId: string,
): Promise<ComponentType<ThemePageProps>> {
    const module =
        await themeRuntimes[normalizeStatusPageThemeId(themeId)].page();
    return module.default;
}

export async function loadIncidentDetailComponent(
    themeId: string,
): Promise<ComponentType<ThemeIncidentDetailProps>> {
    const module =
        await themeRuntimes[normalizeStatusPageThemeId(themeId)].incident();
    return module.default;
}

export async function loadUpdatesComponent(
    themeId: string,
): Promise<ComponentType<ThemeUpdatesProps>> {
    const module =
        await themeRuntimes[normalizeStatusPageThemeId(themeId)].updates();
    return module.default;
}
