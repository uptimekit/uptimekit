import { getStatusPageByDomain } from "@/status-page/lib/db-queries";
import {
    getDomainFromHost,
    getHostFromHeaders,
} from "@/status-page/lib/route-utils";
import {
    renderStatusSummary,
    statusSummaryNotFound,
    statusSummaryPreflight,
} from "@/status-page/lib/status-summary";

export async function GET(request: Request) {
    const host = getHostFromHeaders(request.headers);

    if (!host) {
        return statusSummaryNotFound();
    }

    const pageConfig = await getStatusPageByDomain(getDomainFromHost(host));

    if (!pageConfig) {
        return statusSummaryNotFound();
    }
    return renderStatusSummary({ request, pageConfig });
}

export function OPTIONS() {
    return statusSummaryPreflight();
}
