import { getStatusPageByDomain } from "@/status-page/lib/db-queries";
import {
    getDomainFromHost,
    getHostFromHeaders,
} from "@/status-page/lib/route-utils";
import { feedNotFound, renderStatusFeed } from "@/status-page/lib/status-feed";

export async function GET(request: Request) {
    const host = getHostFromHeaders(request.headers);

    if (!host) {
        return feedNotFound();
    }

    const pageConfig = await getStatusPageByDomain(getDomainFromHost(host));

    if (!pageConfig) {
        return feedNotFound();
    }

    return renderStatusFeed({ request, pageConfig, format: "rss" });
}
