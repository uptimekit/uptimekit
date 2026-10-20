import { getStatusPageBySlug } from "@/status-page/lib/db-queries";
import {
    renderStatusSummary,
    statusSummaryNotFound,
    statusSummaryPreflight,
} from "@/status-page/lib/status-summary";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const pageConfig = await getStatusPageBySlug(slug);

    if (!pageConfig) {
        return statusSummaryNotFound();
    }
    return renderStatusSummary({ request, pageConfig, routeSlug: slug });
}

export function OPTIONS() {
    return statusSummaryPreflight();
}
