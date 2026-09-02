import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
    canAccessStatusPage,
    checkStatusPageAccess,
} from "@/status-page/lib/access-check";
import {
    getStatusPageByDomain,
    getStatusPageBySlug,
} from "@/status-page/lib/db-queries";
import { getFeedAlternates } from "@/status-page/lib/feed-links";
import {
    getDomainFromHost,
    getHostFromHeaders,
    getProtocolFromHeaders,
} from "@/status-page/lib/route-utils";
import { renderStatusBadge } from "@/status-page/lib/status-badge-renderer";
import { normalizeStatusPageDesign } from "@/status-page/lib/status-page-config";
import { renderStatusPage } from "@/status-page/lib/status-page-renderer";

const CUSTOM_DOMAIN_ONLY_SLUGS = new Set(["badge"]);

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const headersList = await headers();
    const host = getHostFromHeaders(headersList);
    const protocol = getProtocolFromHeaders(headersList);

    const pageConfig = await getStatusPageBySlug(slug);
    const canAccessPage = pageConfig
        ? await canAccessStatusPage(pageConfig)
        : false;

    if (pageConfig && !canAccessPage) {
        return {
            title: "Private Status Page",
            description: "This status page requires a password.",
            robots: {
                index: false,
                follow: false,
            },
        };
    }

    const title = pageConfig?.name
        ? `${pageConfig.name} Status`
        : "Status Page";
    const description = pageConfig?.name
        ? `Real-time status and incident history for ${pageConfig.name}. Check system availability and past incidents.`
        : "Real-time system status and incident history.";

    const design = normalizeStatusPageDesign(pageConfig?.design);
    const logoUrl = design.logoUrl;

    return {
        title,
        description,
        applicationName: pageConfig?.name || "Status Page",
        icons:
            design.faviconUrl || logoUrl
                ? { icon: design.faviconUrl || logoUrl }
                : undefined,
        alternates: {
            types: getFeedAlternates(slug),
        },
        openGraph: {
            title,
            description,
            siteName: title,
            images: host
                ? [
                      {
                          url: `${protocol}://${host}/${slug}/api/og`,
                          width: 1200,
                          height: 630,
                          alt: title,
                      },
                  ]
                : undefined,
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: host ? [`${protocol}://${host}/${slug}/api/og`] : undefined,
        },
        robots: {
            index: true,
            follow: true,
        },
    };
}

export default async function SlugStatusPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    if (CUSTOM_DOMAIN_ONLY_SLUGS.has(slug)) {
        const headersList = await headers();
        const host = getHostFromHeaders(headersList);

        if (!host) {
            notFound();
        }

        const pageConfig = await getStatusPageByDomain(getDomainFromHost(host));

        if (!pageConfig) {
            notFound();
        }

        await checkStatusPageAccess(pageConfig, `/${slug}`);

        return renderStatusBadge(pageConfig);
    }

    const pageConfig = await getStatusPageBySlug(slug);

    if (!pageConfig) {
        notFound();
    }

    await checkStatusPageAccess(pageConfig, `/${slug}`);

    return renderStatusPage(pageConfig, slug);
}
