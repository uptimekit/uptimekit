import { notFound } from "next/navigation";
import { checkStatusPageAccess } from "@/lib/access-check";
import { getStatusPageBySlug } from "@/lib/db-queries";
import { prepareMaintenanceDetailData } from "@/lib/subpage-data-preparer";
import { loadMaintenanceDetailComponent } from "@/lib/theme-loader";
import { ThemePageWrapper } from "@/themes/theme-page-wrapper";

export default async function SlugMaintenanceDetailsPage({
	params,
}: {
	params: Promise<{ slug: string; id: string }>;
}) {
	const { slug, id } = await params;

	const pageConfig = await getStatusPageBySlug(slug);

	if (!pageConfig) {
		notFound();
	}

	await checkStatusPageAccess(pageConfig, `/${slug}/maintenance/${id}`);

	const design = (pageConfig.design as any) || {};
	const themeId = design.themeId || "default";

	const MaintenanceDetailPage = await loadMaintenanceDetailComponent(themeId);

	try {
		const data = await prepareMaintenanceDetailData(pageConfig, id, slug);
		return (
			<ThemePageWrapper
				themeId={themeId}
				theme={design.theme}
				ThemeComponent={MaintenanceDetailPage}
				componentProps={{ data }}
			/>
		);
	} catch {
		notFound();
	}
}
