import { getStatusPageData } from "@/status-page/lib/data-preparer";
import type { StatusPageRecord } from "@/status-page/lib/db-queries";
import type { IncidentHistoryPeriod } from "@/status-page/lib/incident-history";
import { getLinkedStatusPages } from "@/status-page/lib/linked-pages";
import { normalizeStatusPageDesign } from "@/status-page/lib/status-page-config";
import {
    prepareIncidentDetailData,
    prepareUpdatesPageData,
} from "@/status-page/lib/subpage-data-preparer";
import {
    loadIncidentDetailComponent,
    loadThemeComponent,
    loadUpdatesComponent,
} from "@/status-page/lib/theme-loader";
import { ThemePageWrapper } from "@/status-page/themes/theme-page-wrapper";

interface PublicPageRecord {
    id: string;
    name: string;
    slug: string;
    design?: unknown;
    [key: string]: unknown;
}

export async function renderStatusPage(
    pageConfig: StatusPageRecord,
    routeSlug?: string,
) {
    const design = normalizeStatusPageDesign(pageConfig.design);
    const [ThemePage, data, linkedPages] = await Promise.all([
        loadThemeComponent(design.themeId),
        getStatusPageData(pageConfig, routeSlug),
        // Loaded outside the cached page data so two pages linking each other can't recurse
        getLinkedStatusPages(pageConfig.id),
    ]);

    return (
        <ThemePageWrapper
            themeId={design.themeId}
            theme={design.theme}
            ThemeComponent={ThemePage}
            componentProps={{ data: { ...data, linkedPages } }}
        />
    );
}

export async function renderIncidentDetailPage(
    pageConfig: PublicPageRecord,
    incidentId: string,
    routeSlug?: string,
) {
    const design = normalizeStatusPageDesign(pageConfig.design);
    const [IncidentPage, data] = await Promise.all([
        loadIncidentDetailComponent(design.themeId),
        prepareIncidentDetailData(pageConfig, incidentId, routeSlug),
    ]);

    return (
        <ThemePageWrapper
            themeId={design.themeId}
            theme={design.theme}
            ThemeComponent={IncidentPage}
            componentProps={{ data }}
        />
    );
}

export async function renderUpdatesPage(
    pageConfig: PublicPageRecord,
    period: IncidentHistoryPeriod,
    routeSlug?: string,
) {
    const design = normalizeStatusPageDesign(pageConfig.design);
    const [UpdatesPage, data] = await Promise.all([
        loadUpdatesComponent(design.themeId),
        prepareUpdatesPageData(pageConfig, period, routeSlug),
    ]);

    return (
        <ThemePageWrapper
            themeId={design.themeId}
            theme={design.theme}
            ThemeComponent={UpdatesPage}
            componentProps={{ data }}
        />
    );
}
