import type { ComponentType } from "react";
import { themeRegistry } from "@/themes";
import type {
	ThemeIncidentDetailProps,
	ThemeMaintenanceDetailProps,
	ThemeManifest,
	ThemePageProps,
	ThemeUpdatesProps,
} from "@/themes/types";

const themeLoaders: Record<
	string,
	() => Promise<{ default: ComponentType<ThemePageProps> }>
> = {
	default: () => import("@/themes/default/page"),
	flat: () => import("@/themes/flat/page"),
	signal: () => import("@/themes/signal/page"),
};

const incidentDetailLoaders: Record<
	string,
	() => Promise<{ default: ComponentType<ThemeIncidentDetailProps> }>
> = {
	default: () => import("@/themes/default/incident-detail"),
	flat: () => import("@/themes/flat/incident-detail"),
	signal: () => import("@/themes/signal/incident-detail"),
};

const maintenanceDetailLoaders: Record<
	string,
	() => Promise<{ default: ComponentType<ThemeMaintenanceDetailProps> }>
> = {
	default: () => import("@/themes/default/maintenance-detail"),
	flat: () => import("@/themes/flat/maintenance-detail"),
	signal: () => import("@/themes/signal/maintenance-detail"),
};

const updatesLoaders: Record<
	string,
	() => Promise<{ default: ComponentType<ThemeUpdatesProps> }>
> = {
	default: () => import("@/themes/default/updates"),
	flat: () => import("@/themes/flat/updates"),
	signal: () => import("@/themes/signal/updates"),
};

export async function loadThemeComponent(
	themeId: string,
): Promise<ComponentType<ThemePageProps>> {
	const loader = themeLoaders[themeId] ?? themeLoaders.default;
	const module = await loader();
	return module.default;
}

export async function loadIncidentDetailComponent(
	themeId: string,
): Promise<ComponentType<ThemeIncidentDetailProps>> {
	const loader =
		incidentDetailLoaders[themeId] ?? incidentDetailLoaders.default;
	const module = await loader();
	return module.default;
}

export async function loadMaintenanceDetailComponent(
	themeId: string,
): Promise<ComponentType<ThemeMaintenanceDetailProps>> {
	const loader =
		maintenanceDetailLoaders[themeId] ?? maintenanceDetailLoaders.default;
	const module = await loader();
	return module.default;
}

export async function loadUpdatesComponent(
	themeId: string,
): Promise<ComponentType<ThemeUpdatesProps>> {
	const loader = updatesLoaders[themeId] ?? updatesLoaders.default;
	const module = await loader();
	return module.default;
}

export function getThemeManifest(themeId: string): ThemeManifest | undefined {
	return themeRegistry[themeId];
}
