import { notFound } from "next/navigation";
import { checkStatusPageAccess } from "@/lib/access-check";
import { getStatusPageBySlug } from "@/lib/db-queries";
import { prepareUpdatesPageData } from "@/lib/subpage-data-preparer";
import { loadUpdatesComponent } from "@/lib/theme-loader";
import { ThemePageWrapper } from "@/themes/theme-page-wrapper";

export default async function SlugUpdatesPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;

	const pageConfig = await getStatusPageBySlug(slug);

	if (!pageConfig) {
		notFound();
	}

	await checkStatusPageAccess(pageConfig, `/${slug}/updates`);

	const design = (pageConfig.design as any) || {};
	const themeId = design.themeId || "default";

	const UpdatesPage = await loadUpdatesComponent(themeId);

	let data;
	try {
		data = await prepareUpdatesPageData(pageConfig, slug);
	} catch (error) {
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
