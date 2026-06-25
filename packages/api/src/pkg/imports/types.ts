import { z } from "zod";
import {
    monitorTimingSchema,
    withMonitorTimingRelations,
} from "../../lib/monitor-timing";

export const IMPORTED_MONITOR_TYPES = [
    "http",
    "http-json",
    "tcp",
    "ping",
    "dns",
    "keyword",
] as const;

export type ImportedMonitorType = (typeof IMPORTED_MONITOR_TYPES)[number];

const httpFamilyConfig = {
    url: z.string(),
    method: z.string(),
    headers: z.array(z.object({ key: z.string(), value: z.string() })),
    body: z.string(),
    acceptedStatusCodes: z.string(),
    checkSsl: z.boolean(),
    sslCertExpiryNotificationDays: z.number(),
};

const configSchemaByType: Record<ImportedMonitorType, z.ZodType> = {
    http: z.object(httpFamilyConfig),
    keyword: z.object({ ...httpFamilyConfig, keyword: z.string() }),
    "http-json": z.object({ ...httpFamilyConfig, jsonPath: z.string() }),
    tcp: z.object({ hostname: z.string(), port: z.number() }),
    ping: z.object({ hostname: z.string() }),
    dns: z.object({
        hostname: z.string(),
        resolverServers: z.string(),
        port: z.number(),
        recordType: z.string(),
        expectedValue: z.string(),
    }),
};

export const importedMonitorSchema = withMonitorTimingRelations(
    z.object({
        sourceId: z.string(),
        name: z.string().min(1),
        type: z.enum(IMPORTED_MONITOR_TYPES),
        ...monitorTimingSchema,
        config: z.record(z.string(), z.any()),
        sourceGroupId: z.string().nullish(),
        tagNames: z.array(z.string()),
        warnings: z.array(z.string()).optional(),
    }),
).refine(
    (monitor) =>
        configSchemaByType[monitor.type]?.safeParse(monitor.config).success ??
        false,
    { message: "Config does not match the monitor type.", path: ["config"] },
);

export type ImportedMonitor = z.infer<typeof importedMonitorSchema>;

export const importedGroupSchema = z.object({
    sourceId: z.string(),
    name: z.string().min(1),
    sourceParentId: z.string().nullish(),
});

export type ImportedGroup = z.infer<typeof importedGroupSchema>;

export const importedTagSchema = z.object({
    name: z.string().min(1),
    color: z.string(),
});

export type ImportedTag = z.infer<typeof importedTagSchema>;

export interface SkippedItem {
    sourceId: string;
    name: string;
    type: string;
    reason: string;
}

export interface ImportSourceResult {
    monitors: ImportedMonitor[];
    groups: ImportedGroup[];
    tags: ImportedTag[];
    skipped: SkippedItem[];
}

export interface ImportSourceMeta<Connection = unknown> {
    id: string;
    label: string;
    description: string;
    logo?: string;
    connectionSchema: z.ZodType<Connection>;
}

export interface ImportSource<Connection = unknown>
    extends ImportSourceMeta<Connection> {
    fetch(connection: Connection): Promise<unknown>;
    map(raw: unknown): ImportSourceResult;
}
