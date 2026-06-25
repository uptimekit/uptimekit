import { isIP } from "node:net";

const RESERVED_HOSTNAMES = new Set(["localhost"]);

const DOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function stripTrailingDot(domain: string) {
    return domain.endsWith(".") ? domain.slice(0, -1) : domain;
}

function stripTrailingSlashes(domain: string) {
    return domain.replace(/\/+$/, "");
}

function parseDomainWithProtocol(value: string) {
    let parsed: URL;

    try {
        parsed = new URL(value);
    } catch {
        throw new Error("Custom domain must be a valid domain name");
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Custom domain must use http or https");
    }

    if (
        parsed.username ||
        parsed.password ||
        parsed.port ||
        parsed.pathname !== "/" ||
        parsed.search ||
        parsed.hash
    ) {
        throw new Error(
            "Custom domain cannot include a path, port, query, or hash",
        );
    }

    return parsed.hostname;
}

function parseDomainWithoutProtocol(value: string) {
    if (
        value.includes("/") ||
        value.includes("?") ||
        value.includes("#") ||
        value.includes("@") ||
        value.includes(":")
    ) {
        throw new Error(
            "Custom domain cannot include a path, port, query, or hash",
        );
    }

    let parsed: URL;

    try {
        parsed = new URL(`https://${value}`);
    } catch {
        throw new Error("Custom domain must be a valid domain name");
    }

    return parsed.hostname;
}

function assertValidDomain(domain: string) {
    if (domain.length > 253) {
        throw new Error("Custom domain is too long");
    }

    if (!domain.includes(".")) {
        throw new Error("Custom domain must include a top-level domain");
    }

    if (domain.startsWith("*.") || domain.includes("*")) {
        throw new Error("Wildcard custom domains are not supported");
    }

    if (isIP(domain)) {
        throw new Error("Custom domain must be a hostname, not an IP address");
    }

    if (
        RESERVED_HOSTNAMES.has(domain) ||
        domain.endsWith(".localhost") ||
        domain.endsWith(".local") ||
        domain.endsWith(".internal")
    ) {
        throw new Error(
            "Custom domain cannot use a reserved internal hostname",
        );
    }

    const labels = domain.split(".");

    if (labels.some((label) => !DOMAIN_LABEL_PATTERN.test(label))) {
        throw new Error("Custom domain must be a valid domain name");
    }
}

export function normalizeStatusPageDomain(
    value: string | null | undefined,
): string | null {
    if (value == null) {
        return null;
    }

    const trimmedValue = value.trim().toLowerCase();

    if (!trimmedValue) {
        return null;
    }

    const domain = stripTrailingDot(
        trimmedValue.startsWith("http://") ||
            trimmedValue.startsWith("https://")
            ? parseDomainWithProtocol(trimmedValue)
            : parseDomainWithoutProtocol(stripTrailingSlashes(trimmedValue)),
    );

    assertValidDomain(domain);

    return domain;
}
