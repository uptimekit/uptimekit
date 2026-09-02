import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
    canAccessStatusPage,
    checkStatusPageAccess,
} from "@/status-page/lib/access-check";
import { getStatusPageByDomain } from "@/status-page/lib/db-queries";
import {
    getDomainFromHost,
    getHostFromHeaders,
    getProtocolFromHeaders,
} from "@/status-page/lib/route-utils";
import { renderIncidentDetailPage } from "@/status-page/lib/status-page-renderer";
import { prepareIncidentDetailData } from "@/status-page/lib/subpage-data-preparer";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const headersList = await headers();
    const host = getHostFromHeaders(headersList);

    if (!host) {
        return {
            title: "Incident",
            robots: { index: false, follow: false },
        };
    }

    const protocol = getProtocolFromHeaders(headersList);
    const pageConfig = await getStatusPageByDomain(getDomainFromHost(host));

    if (!pageConfig || !(await canAccessStatusPage(pageConfig))) {
        return {
            title: "Private Status Page",
            robots: { index: false, follow: false },
        };
    }

    try {
        const { incident } = await prepareIncidentDetailData(pageConfig, id);
        const title = `${incident.title} - ${pageConfig.name}`;
        const description = `Incident status and updates for ${pageConfig.name}.`;
        const imageUrl = `${protocol}://${host}/incidents/${id}/og`;

        return {
            title,
            description,
            openGraph: {
                title,
                description,
                images: [
                    { url: imageUrl, width: 1200, height: 630, alt: title },
                ],
            },
            twitter: {
                card: "summary_large_image",
                title,
                description,
                images: [imageUrl],
            },
        };
    } catch {
        return {
            title: "Incident",
            robots: { index: false, follow: false },
        };
    }
}

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

    return renderIncidentDetailPage(pageConfig, id).catch(() => notFound());
}
