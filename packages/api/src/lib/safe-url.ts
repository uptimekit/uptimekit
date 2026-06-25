import type { LookupAddress } from "node:dns";
import dns from "node:dns/promises";
import http, {
    type IncomingHttpHeaders,
    type IncomingMessage,
    type OutgoingHttpHeaders,
} from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import net from "node:net";

const BLOCKED_HOSTNAMES = new Set(["localhost"]);
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;

const BLOCKED_IPV4_SUBNETS = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
    ["255.255.255.255", 32],
] as const;

const BLOCKED_IPV6_SUBNETS = [
    ["::", 96],
    ["64:ff9b::", 96],
    ["100::", 64],
    ["2001::", 32],
    ["2001:2::", 48],
    ["2001:db8::", 32],
    ["2002::", 16],
    ["fc00::", 7],
    ["fe80::", 10],
    ["ff00::", 8],
] as const;

const blockedAddresses = new net.BlockList();
for (const [address, prefix] of BLOCKED_IPV4_SUBNETS) {
    blockedAddresses.addSubnet(address, prefix, "ipv4");
    blockedAddresses.addSubnet(`::ffff:${address}`, 96 + prefix, "ipv6");
}
for (const [address, prefix] of BLOCKED_IPV6_SUBNETS) {
    blockedAddresses.addSubnet(address, prefix, "ipv6");
}

function isPrivateAddress(address: string) {
    const family = net.isIP(address);
    if (family === 4) {
        return blockedAddresses.check(address, "ipv4");
    }
    if (family === 6) {
        return blockedAddresses.check(address, "ipv6");
    }
    return false;
}

function normalizeHostname(hostname: string) {
    return hostname
        .toLowerCase()
        .replace(/^\[(.*)\]$/, "$1")
        .replace(/\.$/, "");
}

interface SafePublicHttpUrlOptions {
    label?: string;
}

interface FetchPublicHttpUrlOptions extends SafePublicHttpUrlOptions {
    headers?: OutgoingHttpHeaders;
    maxBodyBytes?: number;
    timeoutMs?: number;
}

export interface PublicHttpResponse {
    body: string;
    headers: IncomingHttpHeaders;
    ok: boolean;
    status: number;
}

export class UnsafePublicHttpUrlError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UnsafePublicHttpUrlError";
    }
}

function unsafeUrlError(message: string) {
    return new UnsafePublicHttpUrlError(message);
}

function parsePublicHttpUrl(rawUrl: string, label: string) {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        throw unsafeUrlError(`${label} must be a valid URL`);
    }

    if (!["http:", "https:"].includes(url.protocol)) {
        throw unsafeUrlError(`${label} must use HTTP or HTTPS`);
    }

    return url;
}

function assertSafeHostname(normalizedHostname: string, label: string) {
    if (normalizedHostname.length === 0) {
        throw unsafeUrlError(`${label} must include a hostname`);
    }

    if (
        BLOCKED_HOSTNAMES.has(normalizedHostname) ||
        normalizedHostname.endsWith(".localhost") ||
        normalizedHostname.endsWith(".local") ||
        normalizedHostname.endsWith(".internal")
    ) {
        throw unsafeUrlError(`${label} cannot target internal hosts`);
    }

    if (net.isIP(normalizedHostname) && isPrivateAddress(normalizedHostname)) {
        throw unsafeUrlError(`${label} cannot target private IP addresses`);
    }
}

async function resolvePublicHostname(
    hostname: string,
    label: string,
    family: 0 | 4 | 6 = 0,
) {
    let resolved: LookupAddress[];
    try {
        resolved = await dns.lookup(hostname, {
            all: true,
            family,
            verbatim: true,
        });
    } catch {
        throw unsafeUrlError(`${label} hostname could not be resolved`);
    }

    if (resolved.length === 0) {
        throw unsafeUrlError(`${label} hostname could not be resolved`);
    }

    if (resolved.some((entry) => isPrivateAddress(entry.address))) {
        throw unsafeUrlError(`${label} cannot resolve to a private IP address`);
    }

    return resolved;
}

function getLookupFamily(family: number | string | undefined) {
    if (family === 4 || family === "IPv4") {
        return 4;
    }
    if (family === 6 || family === "IPv6") {
        return 6;
    }
    return 0;
}

function createPublicLookup(label: string): LookupFunction {
    return (hostname, options, callback) => {
        const normalizedHostname = normalizeHostname(hostname);
        try {
            assertSafeHostname(normalizedHostname, label);
        } catch (error) {
            callback(
                error instanceof Error ? error : new Error(String(error)),
                "",
                0,
            );
            return;
        }

        const family = net.isIP(normalizedHostname);
        if (family) {
            if (options.all) {
                callback(null, [{ address: normalizedHostname, family }]);
                return;
            }

            callback(null, normalizedHostname, family);
            return;
        }

        resolvePublicHostname(
            normalizedHostname,
            label,
            getLookupFamily(options.family),
        )
            .then((resolved) => {
                if (options.all) {
                    callback(null, resolved);
                    return;
                }

                const [first] = resolved;
                if (!first) {
                    callback(
                        unsafeUrlError(
                            `${label} hostname could not be resolved`,
                        ),
                        "",
                        0,
                    );
                    return;
                }

                callback(null, first.address, net.isIP(first.address));
            })
            .catch((error) => {
                callback(
                    error instanceof Error ? error : new Error(String(error)),
                    "",
                    0,
                );
            });
    };
}

function readResponseBody(
    response: IncomingMessage,
    maxBodyBytes: number,
    label: string,
) {
    return new Promise<string>((resolve, reject) => {
        const chunks: Buffer[] = [];
        let byteLength = 0;
        let settled = false;

        const fail = (error: Error) => {
            if (settled) {
                return;
            }
            settled = true;
            response.destroy(error);
            reject(error);
        };

        response.on("data", (chunk: Buffer | string) => {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            byteLength += buffer.byteLength;

            if (byteLength > maxBodyBytes) {
                fail(
                    new Error(
                        `${label} response exceeded ${maxBodyBytes} bytes`,
                    ),
                );
                return;
            }

            chunks.push(buffer);
        });

        response.on("end", () => {
            if (settled) {
                return;
            }
            settled = true;
            resolve(Buffer.concat(chunks).toString("utf8"));
        });
        response.on("error", fail);
    });
}

export async function assertSafePublicHttpUrl(
    rawUrl: string,
    options: SafePublicHttpUrlOptions = {},
) {
    const label = options.label ?? "URL";
    const url = parsePublicHttpUrl(rawUrl, label);
    const hostname = normalizeHostname(url.hostname);

    assertSafeHostname(hostname, label);

    if (!net.isIP(hostname)) {
        await resolvePublicHostname(hostname, label);
    }
}

export async function fetchPublicHttpUrl(
    rawUrl: string,
    options: FetchPublicHttpUrlOptions = {},
) {
    const label = options.label ?? "URL";
    const url = parsePublicHttpUrl(rawUrl, label);
    const hostname = normalizeHostname(url.hostname);

    assertSafeHostname(hostname, label);

    const transport = url.protocol === "https:" ? https : http;
    const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
    const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;

    return new Promise<PublicHttpResponse>((resolve, reject) => {
        let settled = false;
        const settleError = (error: Error) => {
            if (settled) {
                return;
            }
            settled = true;
            reject(error);
        };
        const settleResponse = (response: PublicHttpResponse) => {
            if (settled) {
                return;
            }
            settled = true;
            resolve(response);
        };

        const request = transport.request(
            url,
            {
                headers: options.headers,
                lookup: createPublicLookup(label),
                method: "GET",
            },
            (response) => {
                readResponseBody(response, maxBodyBytes, label)
                    .then((body) => {
                        const status = response.statusCode ?? 0;
                        settleResponse({
                            body,
                            headers: response.headers,
                            ok: status >= 200 && status < 300,
                            status,
                        });
                    })
                    .catch((error) => {
                        settleError(
                            error instanceof Error
                                ? error
                                : new Error(String(error)),
                        );
                    });
            },
        );

        request.setTimeout(timeoutMs, () => {
            request.destroy(
                new Error(`${label} request timed out after ${timeoutMs}ms`),
            );
        });
        request.on("error", (error) => {
            settleError(error);
        });
        request.end();
    });
}

export async function assertSafeWebhookUrl(rawUrl: string) {
    await assertSafePublicHttpUrl(rawUrl, { label: "Webhook URL" });
}
