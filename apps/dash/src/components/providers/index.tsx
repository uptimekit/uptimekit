"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sileo";
import { queryClient } from "@/utils/orpc";
import { StatusPageDomainProvider } from "./status-page-domain-provider";
import { ThemeProvider } from "./theme-provider";

export default function Providers({
    children,
    statusPageDomain,
}: {
    children: React.ReactNode;
    statusPageDomain: string;
}) {
    return (
        <StatusPageDomainProvider domain={statusPageDomain}>
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
                    <Toaster position="top-center" theme="light" />
                </NuqsAdapter>
            </ThemeProvider>
        </StatusPageDomainProvider>
    );
}
