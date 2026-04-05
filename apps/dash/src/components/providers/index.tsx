"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/pages";
import { queryClient } from "@/utils/orpc";
import { Toaster } from "../ui/sonner";
import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			disableTransitionOnChange
		>
			<NuqsAdapter>
				<QueryClientProvider client={queryClient}>
					{children}
				</QueryClientProvider>
				<Toaster richColors />
			</NuqsAdapter>
		</ThemeProvider>
	);
}
