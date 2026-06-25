// Subset of Uptime Kuma's monitor object (from the `monitorList` event).
export interface KumaMonitor {
    id: number;
    name: string;
    type: string;
    url?: string | null;
    method?: string | null;
    hostname?: string | null;
    port?: number | null;
    interval?: number | null;
    retryInterval?: number | null;
    maxretries?: number | null;
    timeout?: number | null;
    keyword?: string | null;
    jsonPath?: string | null;
    expectedValue?: string | null;
    ignoreTls?: boolean | null;
    accepted_statuscodes?: string[] | null;
    dns_resolve_type?: string | null;
    dns_resolve_server?: string | null;
    headers?: string | null; // JSON string of a header object, or null
    body?: string | null;
    parent?: number | null; // parent monitor id for grouping (null = top level)
    tags?: KumaTag[] | null;
}

export interface KumaTag {
    tag_id?: number;
    name: string;
    color?: string | null;
    value?: string | null;
}

// Kuma sends monitors as an object keyed by stringified id.
export type KumaMonitorList = Record<string, KumaMonitor>;

export interface KumaConnection {
    url: string;
    username: string;
    password: string;
    token?: string;
}
