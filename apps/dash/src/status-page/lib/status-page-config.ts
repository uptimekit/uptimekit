import {
    normalizeStatusPageThemeId,
    type StatusPageBarStyle,
} from "@uptimekit/config/status-page-themes";
import type {
    NormalizedStatusPageDesign,
    StatusPageConfig,
} from "@/status-page/themes/types";

type RawDesign = Record<string, unknown>;

interface RawStatusPageConfig {
    id: string;
    name: string;
    slug: string;
    design?: unknown;
}

function asOptionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value : undefined;
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
        theme: design.theme === "dark" ? "dark" : "light",
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
