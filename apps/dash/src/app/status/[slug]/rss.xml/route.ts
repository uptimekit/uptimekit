import { getStatusPageBySlug } from "@/status-page/lib/db-queries";
import { feedNotFound, renderStatusFeed } from "@/status-page/lib/status-feed";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const pageConfig = await getStatusPageBySlug(slug);

    if (!pageConfig) {
        return feedNotFound();
    }
    return renderStatusFeed({
        request,
        pageConfig,
        routeSlug: slug,
        format: "rss",
    });
}
