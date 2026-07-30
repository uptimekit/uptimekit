"use client";

import { createContext, useContext } from "react";
import { DEFAULT_STATUS_PAGE_DOMAIN } from "@/lib/status-page-url";

const StatusPageDomainContext = createContext(DEFAULT_STATUS_PAGE_DOMAIN);

export function StatusPageDomainProvider({
    children,
    domain,
}: {
    children: React.ReactNode;
    domain: string;
}) {
    return (
        <StatusPageDomainContext.Provider value={domain}>
            {children}
        </StatusPageDomainContext.Provider>
    );
}

export function useStatusPageDomain() {
    return useContext(StatusPageDomainContext);
}
