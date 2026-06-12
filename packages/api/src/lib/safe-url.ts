import dns from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTNAMES = new Set(["localhost"]);

function isPrivateIpv4(ip: string) {
	const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
	if (parts.length !== 4 || parts.some(Number.isNaN)) {
		return false;
	}

	const [a, b] = parts;
	if (a === undefined || b === undefined) {
		return false;
	}

	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168)
	);
}

function isPrivateIpv6(ip: string) {
	const normalized = ip.toLowerCase();

	if (normalized.startsWith("::ffff:")) {
		return isPrivateIpv4(normalized.slice("::ffff:".length));
	}

	return (
		normalized === "::1" ||
		normalized === "::" ||
		normalized.startsWith("fc") ||
		normalized.startsWith("fd") ||
		normalized.startsWith("fe80:")
	);
}

function isPrivateAddress(address: string) {
	const family = net.isIP(address);
	if (family === 4) {
		return isPrivateIpv4(address);
	}
	if (family === 6) {
		return isPrivateIpv6(address);
	}
	return false;
}

function normalizeHostname(hostname: string) {
	return hostname.toLowerCase().replace(/^\[(.*)\]$/, "$1");
}

interface SafePublicHttpUrlOptions {
	label?: string;
}

export async function assertSafePublicHttpUrl(
	rawUrl: string,
	options: SafePublicHttpUrlOptions = {},
) {
	const label = options.label ?? "URL";
	const url = new URL(rawUrl);

	if (!["http:", "https:"].includes(url.protocol)) {
		throw new Error(`${label} must use HTTP or HTTPS`);
	}

	const hostname = normalizeHostname(url.hostname);
	if (
		BLOCKED_HOSTNAMES.has(hostname) ||
		hostname.endsWith(".localhost") ||
		hostname.endsWith(".local") ||
		hostname.endsWith(".internal")
	) {
		throw new Error(`${label} cannot target internal hosts`);
	}

	if (net.isIP(hostname) && isPrivateAddress(hostname)) {
		throw new Error(`${label} cannot target private IP addresses`);
	}

	let resolved: Array<{ address: string }>;
	try {
		resolved = await dns.lookup(hostname, { all: true, verbatim: true });
	} catch {
		throw new Error(`${label} hostname could not be resolved`);
	}

	if (resolved.length === 0) {
		throw new Error(`${label} hostname could not be resolved`);
	}

	if (resolved.some((entry) => isPrivateAddress(entry.address))) {
		throw new Error(`${label} cannot resolve to a private IP address`);
	}
}

export async function assertSafeWebhookUrl(rawUrl: string) {
	await assertSafePublicHttpUrl(rawUrl, { label: "Webhook URL" });
}
