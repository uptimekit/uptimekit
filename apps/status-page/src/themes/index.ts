import { manifest as defaultManifest } from "./default/manifest";
import type { ThemeManifest } from "./types";

export const themeRegistry: Record<string, ThemeManifest> = {
	default: defaultManifest,
};

export function getThemeManifest(themeId: string): ThemeManifest | undefined {
	return themeRegistry[themeId];
}

export function getAllThemes(): ThemeManifest[] {
	return Object.values(themeRegistry);
}
