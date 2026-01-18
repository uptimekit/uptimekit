import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { checkStatusPageAccess } from "@/lib/access-check";
import { getStatusPageByDomain } from "@/lib/db-queries";
import { prepareMaintenanceDetailData } from "@/lib/subpage-data-preparer";
import { loadMaintenanceDetailComponent } from "@/lib/theme-loader";
import { ThemePageWrapper } from "@/themes/theme-page-wrapper";

export default async function MaintenanceDetailsPage({
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

	await checkStatusPageAccess(pageConfig, `/maintenance/${id}`);

	const design = (pageConfig.design as any) || {};
	const themeId = design.themeId || "default";

	const MaintenanceDetailPage = await loadMaintenanceDetailComponent(themeId);

	try {
		const data = await prepareMaintenanceDetailData(pageConfig, id);
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
