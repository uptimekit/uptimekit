import {
    defaultUppiesLook,
    normalizeStatusPageThemeId,
    type StatusPageBarStyle,
    type UppiesLook,
    uppiesAnnouncementColors,
    uppiesCorners,
    uppiesFonts,
    uppiesSurfaces,
} from "@uptimekit/config/status-page-themes";
import type {
    NormalizedStatusPageDesign,
    StatusPageColorMode,
    StatusPageConfig,
} from "@/status-page/themes/types";

type RawDesign = Record<string, unknown>;

export interface RawStatusPageConfig {
    id: string;
    name: string;
    slug: string;
    design?: unknown;
}

function asOptionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value : undefined;
}

export function normalizeStatusPageColorMode(
    value: unknown,
): StatusPageColorMode {
    return value === "dark" || value === "system" ? value : "light";
}

function normalizeBarStyle(value: unknown): StatusPageBarStyle {
    return value === "length" || value === "signal" ? value : "normal";
}

function normalizeBarDays(value: unknown): 30 | 60 | 90 {
    return value === 30 || value === 60 ? value : 90;
}

function normalizePercentDigits(value: unknown): number {
    const digits = Number(value);
    return Number.isInteger(digits) && digits >= 2 && digits <= 6 ? digits : 2;
}

function oneOf<T extends string>(
    value: unknown,
    choices: readonly T[],
    fallback: T,
): T {
    return choices.includes(value as T) ? (value as T) : fallback;
}

function asString(value: unknown): string {
    return typeof value === "string" ? value : "";
}

export function normalizeUppiesLook(rawLook: unknown): UppiesLook {
    const look: RawDesign =
        rawLook && typeof rawLook === "object" ? (rawLook as RawDesign) : {};
    const hue = Number(look.accentHue);
    const fallback = defaultUppiesLook;

    return {
        accentHue:
            Number.isInteger(hue) && hue >= 0 && hue <= 360
                ? hue
                : fallback.accentHue,
        surface: oneOf(look.surface, uppiesSurfaces, fallback.surface),
        corners: oneOf(look.corners, uppiesCorners, fallback.corners),
        font: oneOf(look.font, uppiesFonts, fallback.font),
        showStatusIcon: look.showStatusIcon !== false,
        tagline: asString(look.tagline),
        footerText: asString(look.footerText),
        announcement: asString(look.announcement),
        announcementColor: oneOf(
            look.announcementColor,
            uppiesAnnouncementColors,
            fallback.announcementColor,
        ),
        navLinks: asString(look.navLinks),
    };
}

export function normalizeStatusPageDesign(
    rawDesign: unknown,
): NormalizedStatusPageDesign {
    const design: RawDesign =
        rawDesign && typeof rawDesign === "object"
            ? (rawDesign as RawDesign)
            : {};
    const defaultSectionCollapsible =
        design.defaultSectionCollapsible !== false;

    return {
        themeId: normalizeStatusPageThemeId(design.themeId),
        theme: normalizeStatusPageColorMode(design.theme),
        logoUrl: asOptionalString(design.logoUrl),
        faviconUrl: asOptionalString(design.faviconUrl),
        websiteUrl: asOptionalString(design.websiteUrl),
        contactUrl: asOptionalString(design.contactUrl),
        customCss: typeof design.customCss === "string" ? design.customCss : "",
        headerLayout:
            design.headerLayout === "horizontal" ? "horizontal" : "vertical",
        barStyle: normalizeBarStyle(design.barStyle),
        barDays: normalizeBarDays(design.barDays),
        percentDigits: normalizePercentDigits(design.percentDigits),
        defaultSectionCollapsible,
        defaultSectionCollapsed:
            defaultSectionCollapsible &&
            design.defaultSectionCollapsed === true,
        allowSubscriptions: design.allowSubscriptions !== false,
        uppies: normalizeUppiesLook(design.uppies),
    };
}

export function prepareStatusPageConfig(
    pageConfig: RawStatusPageConfig,
    routeSlug?: string,
): StatusPageConfig {
    return {
        id: pageConfig.id,
        name: pageConfig.name,
        slug: pageConfig.slug,
        routeSlug,
        design: normalizeStatusPageDesign(pageConfig.design),
    };
}
