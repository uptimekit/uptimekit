import { headers } from "next/headers";
import { DEFAULT_STATUS_PAGE_DOMAIN } from "./status-page-url";

interface StatusPageEnvironment {
    [key: string]: string | undefined;
    APP_STATUS_PAGE_DOMAIN?: string;
    NEXT_PUBLIC_STATUS_PAGE_DOMAIN?: string;
}

function getNonEmptyValue(value: string | undefined) {
    const normalizedValue = value?.trim();
    return normalizedValue || undefined;
}

function getConfiguredStatusPageDomain(environment: StatusPageEnvironment) {
    return (
        getNonEmptyValue(environment.APP_STATUS_PAGE_DOMAIN) ||
        getNonEmptyValue(environment.NEXT_PUBLIC_STATUS_PAGE_DOMAIN)
    );
}

export function getRuntimeStatusPageDomain(
    environment: StatusPageEnvironment = process.env,
) {
    return (
        getConfiguredStatusPageDomain(environment) || DEFAULT_STATUS_PAGE_DOMAIN
    );
}

/**
 * Uses the configured env var when set, otherwise the origin the browser
 * used to reach the app, so self-hosted installs don't show uptimekit.dev.
 */
export async function resolveStatusPageDomain(
    environment: StatusPageEnvironment = process.env,
) {
    const configured = getConfiguredStatusPageDomain(environment);
    if (configured) return configured;

    const requestHeaders = await headers();
    const host =
        requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
    if (!host) return DEFAULT_STATUS_PAGE_DOMAIN;

    const protocol =
        requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
        (host.startsWith("localhost") ? "http" : "https");
    return `${protocol}://${host}`;
}
