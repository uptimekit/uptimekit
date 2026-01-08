import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "../index.css";
import Providers from "@/components/providers";

const montserrat = Montserrat({
	variable: "--font-montserrat",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: {
		default: "UptimeKit",
		template: "%s | UptimeKit",
	},
	description:
		"The modern status page and monitoring solution for your services.",
	openGraph: {
		title: "UptimeKit",
		description:
			"The modern status page and monitoring solution for your services.",
		url: "https://uptimekit.dev",
		siteName: "UptimeKit",
		images: [
			{
				url: "https://r2.uptimekit.dev/banners/background.png",
				width: 1200,
				height: 630,
				alt: "UptimeKit",
			},
		],
		locale: "en_US",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "UptimeKit",
		description:
			"The modern status page and monitoring solution for your services.",
		images: ["https://r2.uptimekit.dev/banners/background.png"],
	},
	icons: {
		icon: [
			{
				url: "https://r2.uptimekit.dev/logos/uptimekit.svg",
				media: "(prefers-color-scheme: dark)",
			},
			{
				url: "https://r2.uptimekit.dev/logos/uptimekit-dark.svg",
				media: "(prefers-color-scheme: light)",
			},
		],
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script
					async
					crossOrigin="anonymous"
					src="https://tweakcn.com/live-preview.min.js"
				/>
			</head>
			<body
				className={`${montserrat.variable} bg-background text-foreground antialiased`}
			>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
