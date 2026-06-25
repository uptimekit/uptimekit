import type {
    ImportedGroup,
    ImportedMonitor,
    ImportedMonitorType,
    ImportedTag,
    ImportSourceResult,
    SkippedItem,
} from "../../types";
import type { KumaMonitor, KumaMonitorList } from "./types";

const TYPE_MAP: Record<string, ImportedMonitorType> = {
    http: "http",
    keyword: "keyword",
    "json-query": "http-json",
    port: "tcp",
    ping: "ping",
    dns: "dns",
};

const JSON_QUERY_WARNING =
    "Imported from Uptime Kuma json-query — the check expression may not be fully compatible; please review this monitor.";

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function mapTiming(kuma: KumaMonitor) {
    const interval = clamp(Math.trunc(kuma.interval ?? 60), 10, 86_400);
    const retries = clamp(Math.trunc(kuma.maxretries ?? 2), 0, 10);
    const retryIntervalRaw = kuma.retryInterval ?? Math.min(20, interval);
    const retryInterval = clamp(
        Math.trunc(retryIntervalRaw),
        1,
        Math.min(interval, 300),
    );
    const timeout = clamp(Math.trunc(kuma.timeout ?? 48), 1, 300);

    return { interval, retries, retryInterval, timeout };
}

function parseHeaders(raw: string | null | undefined) {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return [];
        }
        return Object.entries(parsed as Record<string, unknown>).map(
            ([key, value]) => ({ key, value: String(value) }),
        );
    } catch {
        return [];
    }
}

function httpConfig(kuma: KumaMonitor) {
    return {
        url: kuma.url ?? "",
        method: (kuma.method ?? "GET").toUpperCase(),
        headers: parseHeaders(kuma.headers),
        body: kuma.body ?? "",
        acceptedStatusCodes: (kuma.accepted_statuscodes ?? []).join(","),
        checkSsl: !kuma.ignoreTls,
        sslCertExpiryNotificationDays: 30,
    };
}

function buildConfig(
    type: ImportedMonitorType,
    kuma: KumaMonitor,
): { config: Record<string, unknown>; warnings: string[] } {
    switch (type) {
        case "http":
            return { config: httpConfig(kuma), warnings: [] };
        case "keyword":
            return {
                config: { ...httpConfig(kuma), keyword: kuma.keyword ?? "" },
                warnings: [],
            };
        case "http-json":
            return {
                config: { ...httpConfig(kuma), jsonPath: kuma.jsonPath ?? "" },
                warnings: [JSON_QUERY_WARNING],
            };
        case "tcp":
            return {
                config: { hostname: kuma.hostname ?? "", port: kuma.port ?? 0 },
                warnings: [],
            };
        case "ping":
            return { config: { hostname: kuma.hostname ?? "" }, warnings: [] };
        case "dns":
            return {
                config: {
                    hostname: kuma.hostname ?? "",
                    resolverServers: kuma.dns_resolve_server ?? "1.1.1.1",
                    port: kuma.port ?? 53,
                    recordType: kuma.dns_resolve_type ?? "A",
                    expectedValue: kuma.expectedValue ?? "",
                },
                warnings: [],
            };
    }
}

function toGroupRef(parent: number | null | undefined): string | null {
    return parent === null || parent === undefined ? null : String(parent);
}

export function mapKumaMonitorList(list: KumaMonitorList): ImportSourceResult {
    const entries = Object.entries(list);

    const groups: ImportedGroup[] = [];
    const monitors: ImportedMonitor[] = [];
    const skipped: SkippedItem[] = [];
    const tagsByName = new Map<string, ImportedTag>();

    for (const [sourceId, kuma] of entries) {
        if (kuma.type === "group") {
            groups.push({
                sourceId,
                name: kuma.name,
                sourceParentId: toGroupRef(kuma.parent),
            });
            continue;
        }

        const mappedType = TYPE_MAP[kuma.type];
        if (!mappedType) {
            skipped.push({
                sourceId,
                name: kuma.name,
                type: kuma.type,
                reason: "Unsupported monitor type",
            });
            continue;
        }

        const { config, warnings } = buildConfig(mappedType, kuma);
        const timing = mapTiming(kuma);

        const tagNames: string[] = [];
        for (const tag of kuma.tags ?? []) {
            if (!tag?.name) continue;

            if (!tagsByName.has(tag.name)) {
                tagsByName.set(tag.name, {
                    name: tag.name,
                    color: tag.color ?? "#3b82f6",
                });
            }

            if (!tagNames.includes(tag.name)) tagNames.push(tag.name);
        }

        monitors.push({
            sourceId,
            name: kuma.name,
            type: mappedType,
            ...timing,
            config,
            sourceGroupId: toGroupRef(kuma.parent),
            tagNames,
            warnings: warnings.length > 0 ? warnings : undefined,
        });
    }

    return { monitors, groups, tags: Array.from(tagsByName.values()), skipped };
}
