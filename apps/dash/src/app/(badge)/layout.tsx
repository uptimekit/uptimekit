import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Status Badge | UptimeKit",
};

// Badges are embedded in third-party pages, so this layout intentionally loads
// no stylesheets and keeps the document transparent around the badge. The color
// scheme is pinned (and matched on the iframe in the embed code) because browsers
// paint an opaque backdrop when an iframe and its document disagree on it.
export default function BadgeRootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            style={{ background: "transparent", colorScheme: "normal" }}
        >
            <body style={{ background: "transparent", margin: 0 }}>
                {children}
            </body>
        </html>
    );
}
