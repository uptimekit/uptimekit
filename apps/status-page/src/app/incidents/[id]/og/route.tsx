import { canAccessStatusPage } from "@/lib/access-check";
import { getStatusPageByDomain } from "@/lib/db-queries";
import { incidentImageResponse } from "@/lib/incident-og-image";
import { privateImageResponse } from "@/lib/og-responses";
import { getDomainFromHost, getHostFromHeaders } from "@/lib/route-utils";

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
