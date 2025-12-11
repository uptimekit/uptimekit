import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "@/index.css";
import { ThemeProvider } from "@/components/theme-provider";

const montserrat = Montserrat({
	subsets: ["latin", "latin-ext"],
	variable: "--font-montserrat",
});

export const metadata: Metadata = {
	title: "Status Page | UptimeKit",
	description: "Real-time system status and uptime monitoring",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${montserrat.variable} font-sans`}>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					{children}
				</ThemeProvider>
			</body>
		</html>
	);
}
