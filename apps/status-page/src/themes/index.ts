import { manifest as defaultManifest } from "./default/manifest";
import { manifest as flatManifest } from "./flat/manifest";
import { manifest as signalManifest } from "./signal/manifest";
import { manifest as sparkManifest } from "./spark/manifest";
import type { ThemeManifest } from "./types";

export const themeRegistry: Record<string, ThemeManifest> = {
    default: defaultManifest,
    flat: flatManifest,
    signal: signalManifest,
    spark: sparkManifest,
};

export function getThemeManifest(themeId: string): ThemeManifest | undefined {
    return themeRegistry[themeId];
}

export function getAllThemes(): ThemeManifest[] {
    return Object.values(themeRegistry);
}
