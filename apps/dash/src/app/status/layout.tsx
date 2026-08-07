import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Status Page | UptimeKit",
    description: "Real-time system status and uptime monitoring",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return <div className="min-h-screen font-sans">{children}</div>;
}
