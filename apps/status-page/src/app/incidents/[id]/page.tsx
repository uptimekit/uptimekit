import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { checkStatusPageAccess } from "@/lib/access-check";
import { getStatusPageByDomain } from "@/lib/db-queries";
import { getDomainFromHost, getHostFromHeaders } from "@/lib/route-utils";
import { prepareIncidentDetailData } from "@/lib/subpage-data-preparer";
import { loadIncidentDetailComponent } from "@/lib/theme-loader";
import { ThemePageWrapper } from "@/themes/theme-page-wrapper";

export default async function IncidentDetailsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const headersList = await headers();
    const host = getHostFromHeaders(headersList);

    if (!host) {
        notFound();
    }

    const domain = getDomainFromHost(host);
    const pageConfig = await getStatusPageByDomain(domain);

    if (!pageConfig) {
        notFound();
    }

    await checkStatusPageAccess(pageConfig, `/incidents/${id}`);

    const design = (pageConfig.design as any) || {};
    const themeId = design.themeId || "default";

    const IncidentDetailPage = await loadIncidentDetailComponent(themeId);

    try {
        const data = await prepareIncidentDetailData(pageConfig, id);
        return (
            <ThemePageWrapper
                themeId={themeId}
                theme={design.theme}
                ThemeComponent={IncidentDetailPage}
                componentProps={{ data }}
            />
        );
    } catch {
        notFound();
    }
}
