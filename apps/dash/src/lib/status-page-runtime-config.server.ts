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

export function getRuntimeStatusPageDomain(
    environment: StatusPageEnvironment = process.env,
) {
    return (
        getNonEmptyValue(environment.APP_STATUS_PAGE_DOMAIN) ||
        getNonEmptyValue(environment.NEXT_PUBLIC_STATUS_PAGE_DOMAIN) ||
        DEFAULT_STATUS_PAGE_DOMAIN
    );
}
