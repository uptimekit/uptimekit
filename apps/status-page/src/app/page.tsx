import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { checkStatusPageAccess } from "@/lib/access-check";
import { prepareStatusPageData } from "@/lib/data-preparer";
import { getStatusPageByDomain } from "@/lib/db-queries";
import { loadThemeComponent } from "@/lib/theme-loader";
import { ThemePageWrapper } from "@/themes/theme-page-wrapper";

const STATUS_PAGE_DOMAIN = process.env.NEXT_PUBLIC_STATUS_PAGE_DOMAIN;
const DEFAULT_STATUS_PAGE_SLUG = process.env.DEFAULT_STATUS_PAGE_SLUG;

function isStatusPageDomain(host: string): boolean {
	if (!STATUS_PAGE_DOMAIN) return false;
	const domain = host.split(":")[0];
	return domain === STATUS_PAGE_DOMAIN;
}

export async function generateMetadata() {
	const headersList = await headers();
	const host =
		headersList.get("x-forwarded-host") ||
		headersList.get("x-original-host") ||
		headersList.get("host");
	const protocol = headersList.get("x-forwarded-proto") || "https";

	if (!host) {
		return {};
	}

	if (isStatusPageDomain(host)) {
		return {
			title: "Status Pages - UptimeKit",
			description: "Monitor and share service status with your users.",
		};
	}

	const domain = host.split(":")[0];
	const pageConfig = await getStatusPageByDomain(domain);

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
			images: [
				{
					url: `${protocol}://${host}/api/og`,
					width: 1200,
					height: 630,
					alt: title,
				},
			],
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
			images: [`${protocol}://${host}/api/og`],
		},
		robots: {
			index: true,
			follow: true,
		},
	};
}

function LandingPage() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background font-sans text-foreground">
			<div className="mx-auto max-w-2xl px-4 text-center">
				<h1 className="mb-4 font-bold text-4xl tracking-tight">Status Pages</h1>
				<p className="mb-8 text-lg text-muted-foreground">
					This is the status page domain. To view a specific status page, add
					the page slug to the URL.
				</p>
				<p className="text-muted-foreground text-sm">
					Example: {STATUS_PAGE_DOMAIN || "status.example.com"}/your-page-slug
				</p>
			</div>
		</div>
	);
}

export default async function StatusPage() {
	const headersList = await headers();
	const host =
		headersList.get("x-forwarded-host") ||
		headersList.get("x-original-host") ||
		headersList.get("host");

	if (!host) {
		notFound();
	}

	if (isStatusPageDomain(host)) {
		if (DEFAULT_STATUS_PAGE_SLUG) {
			redirect(`/${DEFAULT_STATUS_PAGE_SLUG}`);
		}

		return <LandingPage />;
	}

	const domain = host.split(":")[0];

	const pageConfig = await getStatusPageByDomain(domain);

	if (!pageConfig) {
		notFound();
	}

	await checkStatusPageAccess(pageConfig, "/");

	const design = (pageConfig.design as any) || {};
	const themeId = design.themeId || "default";

	const ThemePage = await loadThemeComponent(themeId);

	const data = await prepareStatusPageData(pageConfig);

	return (
		<ThemePageWrapper
			themeId={themeId}
			theme={design.theme}
			ThemeComponent={ThemePage}
			componentProps={{ data }}
		/>
	);
}
