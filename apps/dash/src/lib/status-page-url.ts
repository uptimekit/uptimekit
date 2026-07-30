export const DEFAULT_STATUS_PAGE_DOMAIN = "status.uptimekit.dev";

function stripProtocol(value: string) {
    return value.replace(/^https?:\/\//i, "");
}

function stripTrailingSlash(value: string) {
    return value.replace(/\/+$/, "");
}

function getUrlForHost(value: string) {
    const normalizedValue = stripTrailingSlash(value.trim());

    if (/^https?:\/\//i.test(normalizedValue)) {
        return normalizedValue;
    }

    return `https://${stripProtocol(normalizedValue)}`;
}

export function getStatusPageBaseDomain(
    statusPageDomain = DEFAULT_STATUS_PAGE_DOMAIN,
) {
    return stripTrailingSlash(
        stripProtocol(statusPageDomain.trim() || DEFAULT_STATUS_PAGE_DOMAIN),
    );
}

export function getStatusPageUrl(
    page: {
        slug: string;
        domain?: string | null;
    },
    statusPageDomain = DEFAULT_STATUS_PAGE_DOMAIN,
) {
    const domain = page.domain?.trim();

    if (domain) {
        return getUrlForHost(domain);
    }

    return `${getUrlForHost(
        statusPageDomain.trim() || DEFAULT_STATUS_PAGE_DOMAIN,
    )}/${page.slug}`;
}
