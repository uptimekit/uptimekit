import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { checkStatusPageAccess } from "@/lib/access-check";
import { getStatusPageByDomain } from "@/lib/db-queries";
import { prepareUpdatesPageData } from "@/lib/subpage-data-preparer";
import { loadUpdatesComponent } from "@/lib/theme-loader";
import { ThemePageWrapper } from "@/themes/theme-page-wrapper";

export default async function UpdatesPage() {
	const headersList = await headers();
	const host = headersList.get("host");

	if (!host) {
		notFound();
	}

	const domain = host.split(":")[0];
	const pageConfig = await getStatusPageByDomain(domain);

	if (!pageConfig) {
		notFound();
	}

	await checkStatusPageAccess(pageConfig, "/updates");

	const design = (pageConfig.design as any) || {};
	const themeId = design.themeId || "default";

	const UpdatesPage = await loadUpdatesComponent(themeId);

	const data = await prepareUpdatesPageData(pageConfig);

	return (
		<ThemePageWrapper
			themeId={themeId}
			theme={design.theme}
			ThemeComponent={UpdatesPage}
			componentProps={{ data }}
		/>
	);
}
