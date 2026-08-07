import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { checkStatusPageAccess } from "@/status-page/lib/access-check";
import { getStatusPageByDomain } from "@/status-page/lib/db-queries";
import { parseIncidentHistoryPeriod } from "@/status-page/lib/incident-history";
import {
    getDomainFromHost,
    getHostFromHeaders,
} from "@/status-page/lib/route-utils";
import { renderUpdatesPage } from "@/status-page/lib/status-page-renderer";

export default async function UpdatesPage({
    searchParams,
}: {
    searchParams: Promise<{ period?: string }>;
}) {
    const headersList = await headers();
    const host = getHostFromHeaders(headersList);
    const params = await searchParams;

    if (!host) {
        notFound();
    }

    const domain = getDomainFromHost(host);
    const pageConfig = await getStatusPageByDomain(domain);

    if (!pageConfig) {
        notFound();
    }

    const period = parseIncidentHistoryPeriod(params.period);
    const currentPath =
        period === "all" ? "/updates" : `/updates?period=${period}`;

    await checkStatusPageAccess(pageConfig, currentPath);

    return renderUpdatesPage(pageConfig, period);
}
