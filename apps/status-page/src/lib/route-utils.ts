export function buildPath(basePath: string, slug?: string): string {
	if (slug) {
		return `/${slug}${basePath}`;
	}
	return basePath;
}

function shouldTrustProxyHeaders(): boolean {
	return process.env.STATUS_PAGE_TRUST_PROXY_HEADERS === "true";
}

function normalizeHost(host: string | null): string | undefined {
	const normalizedHost = host?.split(",")[0]?.trim().toLowerCase();

	if (!normalizedHost) {
		return undefined;
	}

	return normalizedHost;
}

export function getHostFromHeaders(
	headersList: Pick<Headers, "get">,
): string | undefined {
	if (shouldTrustProxyHeaders()) {
		return normalizeHost(
			headersList.get("x-forwarded-host") ||
				headersList.get("x-original-host") ||
				headersList.get("host"),
		);
	}

	return normalizeHost(headersList.get("host"));
}

export function getDomainFromHost(host: string): string {
	return host.split(":")[0];
}

export function getProtocolFromHeaders(
	headersList: Pick<Headers, "get">,
): "http" | "https" {
	if (!shouldTrustProxyHeaders()) {
		return "https";
	}

	return headersList.get("x-forwarded-proto") === "http" ? "http" : "https";
}
