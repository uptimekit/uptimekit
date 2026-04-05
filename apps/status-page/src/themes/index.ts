import { manifest as defaultManifest } from "./default/manifest";
import { manifest as flatManifest } from "./flat/manifest";
import type { ThemeManifest } from "./types";

export const themeRegistry: Record<string, ThemeManifest> = {
	default: defaultManifest,
	flat: flatManifest,
};

export function getThemeManifest(themeId: string): ThemeManifest | undefined {
	return themeRegistry[themeId];
}

export function getAllThemes(): ThemeManifest[] {
	return Object.values(themeRegistry);
}
