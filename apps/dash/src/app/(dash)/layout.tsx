import type { Metadata } from "next";
import "../../index.css";
import Providers from "@/components/providers";
import { getConfig } from "@/lib/config";
import { getRuntimeStatusPageDomain } from "@/lib/status-page-runtime-config.server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
    const config = await getConfig();
    const siteName = config.items.at(0)?.value || "Uptimekit";

    return {
        title: {
            default: siteName,
            template: `%s | ${siteName}`,
        },
        description:
            "The modern status page and monitoring solution for your services.",
        openGraph: {
            title: siteName,
            description:
                "The modern status page and monitoring solution for your services.",
            url: "https://uptimekit.dev",
            siteName: siteName,
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
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const statusPageDomain = getRuntimeStatusPageDomain();

    return (
        <html lang="en" suppressHydrationWarning>
            <body className="text-foreground antialiased">
                <Providers statusPageDomain={statusPageDomain}>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
