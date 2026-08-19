import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { checkStatusPageAccess } from "@/status-page/lib/access-check";
import { getStatusPageByDomain } from "@/status-page/lib/db-queries";
import {
    getDomainFromHost,
    getHostFromHeaders,
} from "@/status-page/lib/route-utils";
import { renderStatusBadge } from "@/status-page/lib/status-badge-renderer";

export const metadata = {
    robots: {
        index: false,
        follow: false,
    },
};

export default async function CustomDomainStatusBadgePage() {
    const host = getHostFromHeaders(await headers());

    if (!host) {
        notFound();
    }

    const pageConfig = await getStatusPageByDomain(getDomainFromHost(host));

    if (!pageConfig) {
        notFound();
    }

    await checkStatusPageAccess(pageConfig, "/badge");

    return renderStatusBadge(pageConfig);
}
