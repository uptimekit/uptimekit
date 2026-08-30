export interface MonitorTimeseriesChangePayload {
    id: string;
    monitorId: string;
    status: string;
    timestamp: string;
    location?: string | null;
}

export interface MonitorTimeseriesEventPayload {
    id: string;
    monitorId: string;
    status: string;
    latency: number;
    timestamp: string;
    statusCode?: number;
    error?: string;
    location?: string | null;
    dnsLookup?: number;
    tcpConnect?: number;
    tlsHandshake?: number;
    ttfb?: number;
    transfer?: number;
}

export interface MonitorTimeseriesPersistencePayload {
    workerId: string;
    changesToInsert: MonitorTimeseriesChangePayload[];
    monitorEvents: MonitorTimeseriesEventPayload[];
}

export interface MonitorTimeseriesOutboxPayload
    extends MonitorTimeseriesPersistencePayload {
    organizationId: string;
}
