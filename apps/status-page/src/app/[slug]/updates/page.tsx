import { notFound } from "next/navigation";
import { checkStatusPageAccess } from "@/lib/access-check";
import { getStatusPageBySlug } from "@/lib/db-queries";
import { parseIncidentHistoryPeriod } from "@/lib/incident-history";
import { prepareUpdatesPageData } from "@/lib/subpage-data-preparer";
import { loadUpdatesComponent } from "@/lib/theme-loader";
import { ThemePageWrapper } from "@/themes/theme-page-wrapper";

export default async function SlugUpdatesPage({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ period?: string }>;
}) {
	const { slug } = await params;
	const query = await searchParams;

	const pageConfig = await getStatusPageBySlug(slug);

	if (!pageConfig) {
		notFound();
	}

	const period = parseIncidentHistoryPeriod(query.period);
	const currentPath =
		period === "all" ? `/${slug}/updates` : `/${slug}/updates?period=${period}`;

	await checkStatusPageAccess(pageConfig, currentPath);

	const design = (pageConfig.design as any) || {};
	const themeId = design.themeId || "default";

	const UpdatesPage = await loadUpdatesComponent(themeId);

	let data: Awaited<ReturnType<typeof prepareUpdatesPageData>>;
	try {
		data = await prepareUpdatesPageData(pageConfig, period, slug);
	} catch (_error) {
		notFound();
	}

	return (
		<ThemePageWrapper
			themeId={themeId}
			theme={design.theme}
			ThemeComponent={UpdatesPage}
			componentProps={{ data }}
		/>
	);
}
