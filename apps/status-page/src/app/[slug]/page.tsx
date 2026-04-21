import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { canAccessStatusPage, checkStatusPageAccess } from "@/lib/access-check";
import { prepareStatusPageData } from "@/lib/data-preparer";
import { getStatusPageBySlug } from "@/lib/db-queries";
import { getHostFromHeaders, getProtocolFromHeaders } from "@/lib/route-utils";
import { loadThemeComponent } from "@/lib/theme-loader";
import { ThemePageWrapper } from "@/themes/theme-page-wrapper";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const headersList = await headers();
	const host = getHostFromHeaders(headersList);
	const protocol = getProtocolFromHeaders(headersList);

	const pageConfig = await getStatusPageBySlug(slug);
	const canAccessPage = pageConfig
		? await canAccessStatusPage(pageConfig)
		: false;

	if (pageConfig && !canAccessPage) {
		return {
			title: "Private Status Page",
			description: "This status page requires a password.",
			robots: {
				index: false,
				follow: false,
			},
		};
	}

	const title = pageConfig?.name ? `${pageConfig.name} Status` : "Status Page";
	const description = pageConfig?.name
		? `Real-time status and incident history for ${pageConfig.name}. Check system availability and past incidents.`
		: "Real-time system status and incident history.";

	const design = (pageConfig?.design as any) || {};
	const logoUrl = design.logoUrl;

	return {
		title,
		description,
		applicationName: pageConfig?.name || "Status Page",
		icons:
			design.faviconUrl || logoUrl
				? { icon: design.faviconUrl || logoUrl }
				: undefined,
		openGraph: {
			title,
			description,
			siteName: title,
			images: host
				? [
						{
							url: `${protocol}://${host}/${slug}/api/og`,
							width: 1200,
							height: 630,
							alt: title,
						},
					]
				: undefined,
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
			images: host ? [`${protocol}://${host}/${slug}/api/og`] : undefined,
		},
		robots: {
			index: true,
			follow: true,
		},
	};
}

export default async function SlugStatusPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;

	const pageConfig = await getStatusPageBySlug(slug);

	if (!pageConfig) {
		notFound();
	}

	await checkStatusPageAccess(pageConfig, `/${slug}`);

	const design = (pageConfig.design as any) || {};
	const themeId = design.themeId || "default";

	const ThemePage = await loadThemeComponent(themeId);

	const data = await prepareStatusPageData(pageConfig, slug);

	return (
		<ThemePageWrapper
			themeId={themeId}
			theme={design.theme}
			ThemeComponent={ThemePage}
			componentProps={{ data }}
		/>
	);
}
