import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { checkStatusPageAccess } from "@/lib/access-check";
import { getStatusPageByDomain } from "@/lib/db-queries";
import { getDomainFromHost, getHostFromHeaders } from "@/lib/route-utils";
import { prepareMaintenanceDetailData } from "@/lib/subpage-data-preparer";
import { loadMaintenanceDetailComponent } from "@/lib/theme-loader";
import { ThemePageWrapper } from "@/themes/theme-page-wrapper";

export default async function MaintenanceDetailsPage({
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

    const pageConfig = await getStatusPageByDomain(getDomainFromHost(host));

    if (!pageConfig) {
        notFound();
    }

    await checkStatusPageAccess(pageConfig, `/maintenance/${id}`);

    const design = (pageConfig.design as any) || {};
    const themeId = design.themeId || "default";
    const MaintenanceDetailPage = await loadMaintenanceDetailComponent(themeId);

    let data: Awaited<ReturnType<typeof prepareMaintenanceDetailData>>;
    try {
        data = await prepareMaintenanceDetailData(pageConfig, id);
    } catch {
        notFound();
    }

    return (
        <ThemePageWrapper
            themeId={themeId}
            theme={design.theme}
            ThemeComponent={MaintenanceDetailPage}
            componentProps={{ data }}
        />
    );
}
