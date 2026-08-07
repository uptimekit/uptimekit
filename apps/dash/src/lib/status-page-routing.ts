const LOCAL_DASH_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function getConfiguredHostname(value: string | undefined): string | undefined {
    if (!value) return undefined;

    try {
        return new URL(value).hostname.toLowerCase();
    } catch {
        return value.split(":")[0]?.trim().toLowerCase() || undefined;
    }
}

export function getHostnameFromHostHeader(
    host: string | null,
): string | undefined {
    const normalizedHost = host?.split(",")[0]?.trim().toLowerCase();
    if (!normalizedHost) return undefined;

    if (normalizedHost.startsWith("[")) {
        const closingBracketIndex = normalizedHost.indexOf("]");
        return closingBracketIndex > 0
            ? normalizedHost.slice(1, closingBracketIndex)
            : undefined;
    }

    return normalizedHost.split(":")[0];
}

export function isStatusPageHost(
    hostname: string,
    environment: Record<string, string | undefined> = process.env,
): boolean {
    const requestHostname = hostname.toLowerCase();
    const statusPageHostname = getConfiguredHostname(
        environment.APP_STATUS_PAGE_DOMAIN ||
            environment.NEXT_PUBLIC_STATUS_PAGE_DOMAIN,
    );

    if (statusPageHostname === requestHostname) return true;
    if (LOCAL_DASH_HOSTS.has(requestHostname)) return false;

    const dashboardHostname = getConfiguredHostname(
        environment.APP_URL ||
            environment.BETTER_AUTH_URL ||
            environment.NEXT_PUBLIC_URL,
    );

    return Boolean(dashboardHostname && dashboardHostname !== requestHostname);
}

export function getStatusPageRewritePath(pathname: string): string {
    return pathname === "/" ? "/status" : `/status${pathname}`;
}

export function isPublicAssetPath(pathname: string): boolean {
    return (
        pathname.startsWith("/_next/") ||
        /\.(?:avif|css|eot|gif|ico|jpe?g|js|map|png|svg|ttf|txt|webp|woff2?)$/i.test(
            pathname,
        )
    );
}
