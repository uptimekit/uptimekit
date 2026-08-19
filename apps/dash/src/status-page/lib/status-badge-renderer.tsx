import { PublicStatusBadge } from "@/status-page/components/public-status-badge";
import { prepareStatusPageData } from "./data-preparer";

interface PublicPageRecord {
    id: string;
    name: string;
    slug: string;
    design?: unknown;
    [key: string]: unknown;
}

export async function renderStatusBadge(
    pageConfig: PublicPageRecord,
    routeSlug?: string,
) {
    const data = await prepareStatusPageData(pageConfig, routeSlug);

    return (
        <main
            style={{
                alignItems: "center",
                display: "flex",
                height: 38,
                justifyContent: "center",
                margin: 0,
                overflow: "hidden",
                padding: 0,
                width: "100%",
            }}
        >
            <PublicStatusBadge
                href={routeSlug ? `/${routeSlug}` : "/"}
                name={pageConfig.name}
                status={data.overallStatus}
            />
        </main>
    );
}
