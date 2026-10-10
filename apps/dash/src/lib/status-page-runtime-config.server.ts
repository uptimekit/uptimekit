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

export function getRequestOrigin(requestHeaders: Headers) {
    const host =
        requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim() ||
        requestHeaders.get("host");
    if (!host) return undefined;

    // Next.js sets x-forwarded-proto from the incoming socket, so a missing
    // value means plain HTTP rather than something to guess from the host.
    const protocol =
        requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
        "http";
    return `${protocol}://${host}`;
}

/**
 * Uses the configured env var when set, otherwise the dashboard origin, so
 * self-hosted installs don't show uptimekit.dev. The dashboard host isn't
 * rewritten to status pages, so that fallback keeps the /status prefix.
 */
export async function resolveStatusPageDomain(
    environment: StatusPageEnvironment = process.env,
) {
    const configured = getConfiguredStatusPageDomain(environment);
    if (configured) return configured;

    const origin = getRequestOrigin(await headers());
    if (!origin) return DEFAULT_STATUS_PAGE_DOMAIN;

    return `${origin}/status`;
}
