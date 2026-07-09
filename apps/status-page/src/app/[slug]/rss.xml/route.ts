import { getStatusPageBySlug } from "@/lib/db-queries";
import { feedNotFound, renderStatusFeed } from "@/lib/status-feed";

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
