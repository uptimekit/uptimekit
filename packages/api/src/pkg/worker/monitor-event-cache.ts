import type { monitor } from "@uptimekit/db/schema/monitors";

export type MonitorEventConfig = Pick<
    typeof monitor.$inferSelect,
    | "id"
    | "organizationId"
    | "name"
    | "incidentPendingDuration"
    | "publishIncidentToStatusPage"
>;

export type MonitorEventMetadata = {
    monitorConfig: MonitorEventConfig;
};

const MONITOR_EVENT_METADATA_CACHE_TTL_MS = 30 * 1000;
const MAX_MONITOR_EVENT_METADATA_CACHE_ENTRIES = 1024;

const monitorEventMetadataCache = new Map<
    string,
    { expiresAt: number; metadata: MonitorEventMetadata }
>();

export function getMonitorEventMetadata(monitorId: string) {
    const entry = monitorEventMetadataCache.get(monitorId);
    if (!entry) {
        return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
        monitorEventMetadataCache.delete(monitorId);
        return undefined;
    }

    return entry.metadata;
}

export function setMonitorEventMetadata(
    monitorId: string,
    metadata: MonitorEventMetadata,
) {
    monitorEventMetadataCache.delete(monitorId);
    monitorEventMetadataCache.set(monitorId, {
        expiresAt: Date.now() + MONITOR_EVENT_METADATA_CACHE_TTL_MS,
        metadata,
    });

    while (
        monitorEventMetadataCache.size >
        MAX_MONITOR_EVENT_METADATA_CACHE_ENTRIES
    ) {
        const oldestMonitorId = monitorEventMetadataCache.keys().next().value;
        if (oldestMonitorId === undefined) {
            break;
        }
        monitorEventMetadataCache.delete(oldestMonitorId);
    }
}

export function invalidateMonitorEventMetadataCache(monitorId?: string) {
    if (monitorId) {
        monitorEventMetadataCache.delete(monitorId);
        return;
    }

    monitorEventMetadataCache.clear();
}
