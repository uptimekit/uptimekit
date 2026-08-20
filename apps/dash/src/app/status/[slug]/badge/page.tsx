import { notFound } from "next/navigation";
import { checkStatusPageAccess } from "@/status-page/lib/access-check";
import { getStatusPageBySlug } from "@/status-page/lib/db-queries";
import { renderStatusBadge } from "@/status-page/lib/status-badge-renderer";

export const dynamic = "force-dynamic";

export const metadata = {
    robots: {
        index: false,
        follow: false,
    },
};

export default async function StatusBadgePage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const pageConfig = await getStatusPageBySlug(slug);

    if (!pageConfig) {
        notFound();
    }

    await checkStatusPageAccess(pageConfig, `/${slug}/badge`);

    return renderStatusBadge(pageConfig, slug);
}
