import { RootProvider } from "fumadocs-ui/provider/next";
import "./global.css";

import type { Metadata } from "next";
import { Montserrat } from "next/font/google";

export const metadata: Metadata = {
	title: {
		template: "%s | Uptimekit",
		default: "Uptimekit",
	},
	description: "Open Source Status Page & Monitoring Solution",
	icons: {
		icon: "https://r2.uptimekit.dev/logos/uptimekit.svg",
	},
	openGraph: {
		title: "Uptimekit",
		description: "Open Source Status Page & Monitoring Solution",
		url: "https://uptimekit.dev",
		siteName: "Uptimekit",
		images: ["https://r2.uptimekit.dev/banners/background.png"],
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "Uptimekit",
		description: "Open Source Status Page & Monitoring Solution",
		images: ["https://r2.uptimekit.dev/banners/background.png"],
	},
};

const montserrat = Montserrat({
	subsets: ["latin"],
});

export default function Layout({ children }: LayoutProps<"/">) {
	return (
		<html lang="en" className={montserrat.className} suppressHydrationWarning>
			<body className="flex min-h-screen flex-col">
				<RootProvider>{children}</RootProvider>
			</body>
		</html>
	);
}
