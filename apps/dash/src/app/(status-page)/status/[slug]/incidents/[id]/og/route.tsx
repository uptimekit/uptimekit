import { canAccessStatusPage } from "@/status-page/lib/access-check";
import { getStatusPageBySlug } from "@/status-page/lib/db-queries";
import { incidentImageResponse } from "@/status-page/lib/incident-og-image";
import { privateImageResponse } from "@/status-page/lib/og-responses";

export const runtime = "nodejs";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    const { slug, id } = await params;
    const pageConfig = await getStatusPageBySlug(slug);

    if (!pageConfig || !(await canAccessStatusPage(pageConfig))) {
        return privateImageResponse();
    }

    return incidentImageResponse(pageConfig, id, slug);
}
