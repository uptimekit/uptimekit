import { notFound } from "next/navigation";
import { checkStatusPageAccess } from "@/lib/access-check";
import { getStatusPageBySlug } from "@/lib/db-queries";
import { prepareIncidentDetailData } from "@/lib/subpage-data-preparer";
import { loadIncidentDetailComponent } from "@/lib/theme-loader";
import { ThemePageWrapper } from "@/themes/theme-page-wrapper";

export default async function SlugIncidentDetailsPage({
	params,
}: {
	params: Promise<{ slug: string; id: string }>;
}) {
	const { slug, id } = await params;

	const pageConfig = await getStatusPageBySlug(slug);

	if (!pageConfig) {
		notFound();
	}

	await checkStatusPageAccess(pageConfig, `/${slug}/incidents/${id}`);

	const design = (pageConfig.design as any) || {};
	const themeId = design.themeId || "default";

	const IncidentDetailPage = await loadIncidentDetailComponent(themeId);

	try {
		const data = await prepareIncidentDetailData(pageConfig, id, slug);
		return (
			<ThemePageWrapper
				themeId={themeId}
				theme={design.theme}
				ThemeComponent={IncidentDetailPage}
				componentProps={{ data }}
			/>
		);
	} catch {
		notFound();
	}
}
