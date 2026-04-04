import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { checkStatusPageAccess } from "@/lib/access-check";
import { getStatusPageByDomain } from "@/lib/db-queries";
import { parseIncidentHistoryPeriod } from "@/lib/incident-history";
import { prepareUpdatesPageData } from "@/lib/subpage-data-preparer";
import { loadUpdatesComponent } from "@/lib/theme-loader";
import { ThemePageWrapper } from "@/themes/theme-page-wrapper";

export default async function UpdatesPage({
	searchParams,
}: {
	searchParams: Promise<{ period?: string }>;
}) {
	const headersList = await headers();
	const host = headersList.get("host");
	const params = await searchParams;

	if (!host) {
		notFound();
	}

	const domain = host.split(":")[0];
	const pageConfig = await getStatusPageByDomain(domain);

	if (!pageConfig) {
		notFound();
	}

	const period = parseIncidentHistoryPeriod(params.period);
	const currentPath =
		period === "all" ? "/updates" : `/updates?period=${period}`;

	await checkStatusPageAccess(pageConfig, currentPath);

	const design = (pageConfig.design as any) || {};
	const themeId = design.themeId || "default";

	const UpdatesPage = await loadUpdatesComponent(themeId);

	const data = await prepareUpdatesPageData(pageConfig, period);

	return (
		<ThemePageWrapper
			themeId={themeId}
			theme={design.theme}
			ThemeComponent={UpdatesPage}
			componentProps={{ data }}
		/>
	);
}
