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

function normalizeHeaderToken(value: string | null): string | undefined {
	const token = value?.split(",").find((part) => part.trim().length > 0);

	return token?.trim().toLowerCase();
}

/**
 * Resolve the request host from a headers-like object.
 *
 * @param headersList - Any object with `Headers.get`, typically Next request headers.
 * @returns The normalized host string, or `undefined` when no host is available.
 *
 * When `shouldTrustProxyHeaders` is enabled by
 * `STATUS_PAGE_TRUST_PROXY_HEADERS=true`, checks `x-forwarded-host`, then
 * `x-original-host`, then `host`; otherwise only `host` is trusted.
 * Comma-separated values use the first token, and the result is trimmed/lowercased.
 */
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

/**
 * Extract the domain portion from a host value.
 *
 * @param host - A host header value after proxy trust selection.
 * @returns A domain/host without a port; bracketed IPv6 is returned without brackets.
 *
 * Header trust is handled by `getHostFromHeaders` and `shouldTrustProxyHeaders`;
 * this helper only parses the selected host value.
 *
 * Handles `host:port`, `[ipv6]:port`, plain hostnames, and unbracketed IPv6.
 */
export function getDomainFromHost(host: string): string {
	if (host.startsWith("[")) {
		const closingBracketIndex = host.indexOf("]");

		if (closingBracketIndex > 0) {
			return host.slice(1, closingBracketIndex);
		}
	}

	const firstColonIndex = host.indexOf(":");

	if (firstColonIndex !== -1 && firstColonIndex === host.lastIndexOf(":")) {
		return host.slice(0, firstColonIndex);
	}

	return host;
}

/**
 * Resolve the protocol for absolute URLs in metadata.
 *
 * @param headersList - Any object with `Headers.get`, typically Next request headers.
 * @returns `"http"` only for an explicit HTTP signal; otherwise `"https"`.
 *
 * When `shouldTrustProxyHeaders` is enabled by
 * `STATUS_PAGE_TRUST_PROXY_HEADERS=true`, reads `x-forwarded-proto`, splits
 * comma-separated values, and uses the first non-empty token. Otherwise uses
 * `STATUS_PAGE_DEFAULT_PROTOCOL`, defaulting to HTTPS.
 */
export function getProtocolFromHeaders(
	headersList: Pick<Headers, "get">,
): "http" | "https" {
	if (!shouldTrustProxyHeaders()) {
		return process.env.STATUS_PAGE_DEFAULT_PROTOCOL?.toLowerCase() === "http"
			? "http"
			: "https";
	}

	return normalizeHeaderToken(headersList.get("x-forwarded-proto")) === "http"
		? "http"
		: "https";
}
