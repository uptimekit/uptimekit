import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
    canAccessStatusPage,
    checkStatusPageAccess,
} from "@/status-page/lib/access-check";
import { getStatusPageBySlug } from "@/status-page/lib/db-queries";
import {
    getHostFromHeaders,
    getProtocolFromHeaders,
} from "@/status-page/lib/route-utils";
import { renderIncidentDetailPage } from "@/status-page/lib/status-page-renderer";
import { prepareIncidentDetailData } from "@/status-page/lib/subpage-data-preparer";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string; id: string }>;
}) {
    const { slug, id } = await params;
    const headersList = await headers();
    const host = getHostFromHeaders(headersList);
    const pageConfig = await getStatusPageBySlug(slug);

    if (!pageConfig || !(await canAccessStatusPage(pageConfig))) {
        return {
            title: "Private Status Page",
            robots: { index: false, follow: false },
        };
    }

    try {
        const { incident } = await prepareIncidentDetailData(
            pageConfig,
            id,
            slug,
        );
        const title = `${incident.title} - ${pageConfig.name}`;
        const description = `Incident status and updates for ${pageConfig.name}.`;
        const imageUrl = host
            ? `${getProtocolFromHeaders(headersList)}://${host}/${slug}/incidents/${id}/og`
            : undefined;

        return {
            title,
            description,
            openGraph: {
                title,
                description,
                images: imageUrl
                    ? [{ url: imageUrl, width: 1200, height: 630, alt: title }]
                    : undefined,
            },
            twitter: {
                card: "summary_large_image",
                title,
                description,
                images: imageUrl ? [imageUrl] : undefined,
            },
        };
    } catch {
        return { title: "Incident" };
    }
}

export default async function SlugIncidentDetailsPage({
    params,
}: {
    params: Promise<{ slug: string; id: string }>;
}) {
    const { slug, id } = await params;

    const pageConfig = await getStatusPageBySlug(slug);

    if (!pageConfig) {
        notFound();
    }

    await checkStatusPageAccess(pageConfig, `/${slug}/incidents/${id}`);

    return renderIncidentDetailPage(pageConfig, id, slug).catch(() =>
        notFound(),
    );
}
