import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { checkStatusPageAccess } from "@/lib/access-check";
import { getStatusPageByDomain } from "@/lib/db-queries";
import { prepareIncidentDetailData } from "@/lib/subpage-data-preparer";
import { loadIncidentDetailComponent } from "@/lib/theme-loader";
import { ThemePageWrapper } from "@/themes/theme-page-wrapper";

export default async function IncidentDetailsPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

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

	await checkStatusPageAccess(pageConfig, `/incidents/${id}`);

	const design = (pageConfig.design as any) || {};
	const themeId = design.themeId || "default";

	const IncidentDetailPage = await loadIncidentDetailComponent(themeId);

	try {
		const data = await prepareIncidentDetailData(pageConfig, id);
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
