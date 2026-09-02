import { notFound } from "next/navigation";
import { checkStatusPageAccess } from "@/status-page/lib/access-check";
import { getStatusPageBySlug } from "@/status-page/lib/db-queries";
import { parseIncidentHistoryPeriod } from "@/status-page/lib/incident-history";
import { renderUpdatesPage } from "@/status-page/lib/status-page-renderer";

export default async function SlugUpdatesPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ period?: string }>;
}) {
    const [{ slug }, query] = await Promise.all([params, searchParams]);

    const pageConfig = await getStatusPageBySlug(slug);

    if (!pageConfig) {
        notFound();
    }

    const period = parseIncidentHistoryPeriod(query.period);
    const currentPath =
        period === "all"
            ? `/${slug}/updates`
            : `/${slug}/updates?period=${period}`;

    await checkStatusPageAccess(pageConfig, currentPath);

    return renderUpdatesPage(pageConfig, period, slug).catch(() => notFound());
}
