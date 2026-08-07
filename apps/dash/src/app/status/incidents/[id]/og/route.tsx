import { canAccessStatusPage } from "@/status-page/lib/access-check";
import { getStatusPageByDomain } from "@/status-page/lib/db-queries";
import { incidentImageResponse } from "@/status-page/lib/incident-og-image";
import { privateImageResponse } from "@/status-page/lib/og-responses";
import {
    getDomainFromHost,
    getHostFromHeaders,
} from "@/status-page/lib/route-utils";

export const runtime = "nodejs";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const host = getHostFromHeaders(request.headers);

    if (!host) {
        return privateImageResponse();
    }

    const pageConfig = await getStatusPageByDomain(getDomainFromHost(host));

    if (!pageConfig || !(await canAccessStatusPage(pageConfig))) {
        return privateImageResponse();
    }

    return incidentImageResponse(pageConfig, id);
}
