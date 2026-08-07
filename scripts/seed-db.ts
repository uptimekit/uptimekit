import {
    createHash,
    randomBytes,
    randomUUID,
    scrypt as scryptCallback,
} from "node:crypto";
import { promisify } from "node:util";
import {
    account,
    apikey,
    configuration,
    db,
    incident,
    incidentActivity,
    incidentMonitor,
    incidentStatusPage,
    integrationConfig,
    type MonitorChangeInsert,
    type MonitorEventInsert,
    member,
    monitor,
    monitorGroup,
    monitorNotification,
    monitorTag,
    organization,
    postgresClient,
    sslCertificateNotification,
    statusPage,
    statusPageEmailSubscribers,
    statusPageGroup,
    statusPageMonitor,
    statusPageReport,
    statusPageReportMonitor,
    statusPageReportUpdate,
    tag,
    timeseries,
    user,
    worker,
    workerApiKey,
} from "@uptimekit/db";
import { and, eq, inArray } from "drizzle-orm";

const DEMO = {
    email: process.env.DEMO_EMAIL?.trim() || "demo@uptimekit.local",
    password: process.env.DEMO_PASSWORD || "DemoPassword123!",
    organizationName: "uptimekit Cloud",
    organizationSlug: process.env.DEMO_ORG_SLUG?.trim() || "uptimekit-cloud",
    statusPageName: "uptimekit Cloud Status",
    statusPageSlug:
        process.env.DEMO_STATUS_PAGE_SLUG?.trim() || "uptimekit-status",
};

const HISTORY_DAYS = 30;
const CHECK_INTERVAL_MINUTES = 5;
const TIMESERIES_INSERT_CHUNK_SIZE = 2_000;

const now = new Date();

const ids = {
    user: randomUUID(),
    account: randomUUID(),
    organization: randomUUID(),
    member: randomUUID(),
    apiKey: randomUUID(),
    workers: {
        brussels: randomUUID(),
        frankfurt: randomUUID(),
        singapore: randomUUID(),
    },
    workerApiKeys: {
        brussels: randomUUID(),
        frankfurt: randomUUID(),
        singapore: randomUUID(),
    },
    groups: {
        edge: randomUUID(),
        customer: randomUUID(),
        data: randomUUID(),
        messaging: randomUUID(),
        platform: randomUUID(),
    },
    tags: {
        production: randomUUID(),
        public: randomUUID(),
        critical: randomUUID(),
        internal: randomUUID(),
        regional: randomUUID(),
    },
    integrations: {
        webhook: randomUUID(),
        ntfy: randomUUID(),
    },
    monitors: {
        api: randomUUID(),
        web: randomUUID(),
        auth: randomUUID(),
        checkout: randomUUID(),
        ingest: randomUUID(),
        database: randomUUID(),
        cache: randomUUID(),
        queue: randomUUID(),
        dns: randomUUID(),
        search: randomUUID(),
        admin: randomUUID(),
    },
    statusPage: randomUUID(),
    statusGroups: {
        core: randomUUID(),
        data: randomUUID(),
        platform: randomUUID(),
    },
    incidents: {
        api: randomUUID(),
        checkout: randomUUID(),
        database: randomUUID(),
        queue: randomUUID(),
    },
    maintenance: {
        active: randomUUID(),
        scheduled: randomUUID(),
        completed: randomUUID(),
    },
    reports: {
        api: randomUUID(),
        database: randomUUID(),
        queue: randomUUID(),
    },
    ssl: {
        web: randomUUID(),
        api: randomUUID(),
    },
    configuration: {
        instanceName: randomUUID(),
        retention: randomUUID(),
    },
} as const;

const workerLocations = {
    [ids.workers.brussels]: "be",
    [ids.workers.frankfurt]: "de",
    [ids.workers.singapore]: "sg",
} satisfies Record<string, string>;

const allWorkerIds = [
    ids.workers.brussels,
    ids.workers.frankfurt,
    ids.workers.singapore,
];

const euWorkerIds = [ids.workers.brussels, ids.workers.frankfurt];

const scrypt = promisify(scryptCallback) as (
    password: string,
    salt: string,
    keylen: number,
    options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

function minutesAgo(minutes: number) {
    return new Date(now.getTime() - minutes * 60_000);
}

function daysAgo(days: number, hour = 12, minute = 0) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - days);
    date.setUTCHours(hour, minute, 0, 0);
    return date;
}

function daysFromNow(days: number, hour = 12, minute = 0) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() + days);
    date.setUTCHours(hour, minute, 0, 0);
    return date;
}

function hoursAfter(date: Date, hours: number) {
    return new Date(date.getTime() + hours * 60 * 60_000);
}

function minutesAfter(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60_000);
}

async function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const key = await scrypt(password.normalize("NFKC"), salt, 64, {
        N: 16_384,
        r: 16,
        p: 1,
        maxmem: 128 * 16_384 * 16 * 2,
    });

    return `${salt}:${key.toString("hex")}`;
}

function hashBetterAuthApiKey(key: string) {
    return createHash("sha256").update(key).digest("base64url");
}

function hashWorkerApiKey(key: string) {
    return createHash("sha256").update(key).digest("hex");
}

function generateWorkerApiKey() {
    return `uk_${randomBytes(32).toString("hex")}`;
}

function generateOrganizationApiKey() {
    return `uk_api_${randomBytes(32).toString("base64url")}`;
}

function createHttpConfig(url: string, extra: Record<string, unknown> = {}) {
    return {
        type: "http",
        url,
        method: "GET",
        headers: {
            Accept: "application/json",
            "User-Agent": "UptimeKit Monitor/4.3",
        },
        checkSsl: true,
        sslCertExpiryNotificationDays: 30,
        acceptedStatusCodes: "200-299",
        ...extra,
    };
}

function getLocations(workerIds: string[]) {
    return [
        ...new Set(
            workerIds
                .map((workerId) => workerLocations[workerId])
                .filter((location): location is string => Boolean(location)),
        ),
    ];
}

type MonitorSeed = typeof monitor.$inferInsert;

function createMonitor(input: {
    id: string;
    groupId: string;
    name: string;
    type: string;
    interval: number;
    timeout: number;
    retries: number;
    retryInterval: number;
    workerIds: string[];
    config: Record<string, unknown>;
    successStatuses?: number[] | null;
    active?: boolean;
    pauseReason?: string | null;
    publishIncidentToStatusPage?: boolean;
    incidentPendingDuration?: number;
    incidentRecoveryDuration?: number;
    createdAt?: Date;
}): MonitorSeed {
    return {
        id: input.id,
        organizationId: ids.organization,
        groupId: input.groupId,
        name: input.name,
        type: input.type,
        active: input.active ?? true,
        pauseReason: input.pauseReason ?? null,
        interval: input.interval,
        timeout: input.timeout,
        retries: input.retries,
        retryInterval: input.retryInterval,
        incidentPendingDuration: input.incidentPendingDuration ?? 60,
        incidentRecoveryDuration: input.incidentRecoveryDuration ?? 120,
        publishIncidentToStatusPage: input.publishIncidentToStatusPage ?? true,
        locations: getLocations(input.workerIds),
        workerIds: input.workerIds,
        config: input.config,
        successStatuses: input.successStatuses ?? null,
        createdAt: input.createdAt ?? daysAgo(45, 9),
        updatedAt: now,
    };
}

const workers = [
    {
        id: ids.workers.brussels,
        name: "Brussels · Europe West",
        location: "be",
        active: true,
        lastHeartbeat: minutesAgo(1),
        version: "4.3.0",
        createdAt: daysAgo(63, 8),
        updatedAt: now,
    },
    {
        id: ids.workers.frankfurt,
        name: "Frankfurt · Europe Central",
        location: "de",
        active: true,
        lastHeartbeat: minutesAgo(2),
        version: "4.3.0",
        createdAt: daysAgo(61, 8),
        updatedAt: now,
    },
    {
        id: ids.workers.singapore,
        name: "Singapore · Asia Pacific",
        location: "sg",
        active: true,
        lastHeartbeat: minutesAgo(3),
        version: "4.3.0",
        createdAt: daysAgo(58, 8),
        updatedAt: now,
    },
] satisfies Array<typeof worker.$inferInsert>;

const groups = [
    {
        id: ids.groups.edge,
        organizationId: ids.organization,
        parentId: null,
        name: "Edge & API",
        createdAt: daysAgo(60, 9),
        updatedAt: now,
    },
    {
        id: ids.groups.customer,
        organizationId: ids.organization,
        parentId: null,
        name: "Customer experience",
        createdAt: daysAgo(60, 9),
        updatedAt: now,
    },
    {
        id: ids.groups.data,
        organizationId: ids.organization,
        parentId: null,
        name: "Data plane",
        createdAt: daysAgo(59, 9),
        updatedAt: now,
    },
    {
        id: ids.groups.messaging,
        organizationId: ids.organization,
        parentId: ids.groups.data,
        name: "Messaging & jobs",
        createdAt: daysAgo(59, 9),
        updatedAt: now,
    },
    {
        id: ids.groups.platform,
        organizationId: ids.organization,
        parentId: null,
        name: "Platform operations",
        createdAt: daysAgo(58, 9),
        updatedAt: now,
    },
] satisfies Array<typeof monitorGroup.$inferInsert>;

const tags = [
    {
        id: ids.tags.production,
        organizationId: ids.organization,
        name: "Production",
        color: "#16a34a",
        createdAt: daysAgo(60, 10),
        updatedAt: now,
    },
    {
        id: ids.tags.public,
        organizationId: ids.organization,
        name: "Public",
        color: "#2563eb",
        createdAt: daysAgo(60, 10),
        updatedAt: now,
    },
    {
        id: ids.tags.critical,
        organizationId: ids.organization,
        name: "Critical path",
        color: "#dc2626",
        createdAt: daysAgo(60, 10),
        updatedAt: now,
    },
    {
        id: ids.tags.internal,
        organizationId: ids.organization,
        name: "Internal",
        color: "#9333ea",
        createdAt: daysAgo(60, 10),
        updatedAt: now,
    },
    {
        id: ids.tags.regional,
        organizationId: ids.organization,
        name: "Regional",
        color: "#d97706",
        createdAt: daysAgo(60, 10),
        updatedAt: now,
    },
] satisfies Array<typeof tag.$inferInsert>;

const integrations = [
    {
        id: ids.integrations.webhook,
        organizationId: ids.organization,
        name: "Incident webhook",
        type: "webhook",
        config: {
            url: "https://hooks.uptimekit.demo/uptimekit",
            secret: randomBytes(24).toString("hex"),
        },
        active: true,
        isDefault: true,
        enabledEvents: [
            "incident.created",
            "incident.updated",
            "incident.resolved",
            "incident.acknowledged",
            "incident.comment_added",
            "monitor.ssl.expiring",
        ],
        createdAt: daysAgo(42, 11),
        updatedAt: now,
    },
    {
        id: ids.integrations.ntfy,
        organizationId: ids.organization,
        name: "On-call notifications",
        type: "ntfy",
        config: {
            serverUrl: "https://ntfy.sh",
            topic: "uptimekit-ops-demo",
            priority: "high",
            tags: "warning,rotating_light",
        },
        active: false,
        isDefault: false,
        enabledEvents: ["incident.created", "incident.resolved"],
        createdAt: daysAgo(38, 14),
        updatedAt: daysAgo(4, 16),
    },
] satisfies Array<typeof integrationConfig.$inferInsert>;

const monitors = [
    createMonitor({
        id: ids.monitors.api,
        groupId: ids.groups.edge,
        name: "Public API",
        type: "http",
        interval: 60,
        timeout: 30,
        retries: 2,
        retryInterval: 15,
        workerIds: allWorkerIds,
        config: createHttpConfig("https://api.uptimekit.demo/health"),
        successStatuses: [200, 204],
        incidentPendingDuration: 60,
        incidentRecoveryDuration: 180,
        createdAt: daysAgo(58, 9),
    }),
    createMonitor({
        id: ids.monitors.web,
        groupId: ids.groups.customer,
        name: "Web application",
        type: "http",
        interval: 60,
        timeout: 30,
        retries: 2,
        retryInterval: 15,
        workerIds: allWorkerIds,
        config: createHttpConfig("https://app.uptimekit.demo/"),
        successStatuses: [200],
        incidentPendingDuration: 120,
        incidentRecoveryDuration: 180,
        createdAt: daysAgo(58, 9),
    }),
    createMonitor({
        id: ids.monitors.auth,
        groupId: ids.groups.edge,
        name: "Authentication",
        type: "http-json",
        interval: 60,
        timeout: 30,
        retries: 2,
        retryInterval: 15,
        workerIds: euWorkerIds,
        config: createHttpConfig("https://auth.uptimekit.demo/health", {
            type: "http-json",
            jsonPath: "$.status",
            expectedValue: "ok",
        }),
        successStatuses: [200],
        createdAt: daysAgo(54, 10),
    }),
    createMonitor({
        id: ids.monitors.checkout,
        groupId: ids.groups.customer,
        name: "Checkout",
        type: "http",
        interval: 60,
        timeout: 30,
        retries: 2,
        retryInterval: 20,
        workerIds: euWorkerIds,
        config: createHttpConfig("https://checkout.uptimekit.demo/ready"),
        successStatuses: [200],
        incidentPendingDuration: 120,
        incidentRecoveryDuration: 180,
        createdAt: daysAgo(52, 10),
    }),
    createMonitor({
        id: ids.monitors.ingest,
        groupId: ids.groups.edge,
        name: "Event ingestion",
        type: "http",
        interval: 120,
        timeout: 30,
        retries: 2,
        retryInterval: 20,
        workerIds: allWorkerIds,
        config: createHttpConfig("https://events.uptimekit.demo/health"),
        successStatuses: [200, 202],
        createdAt: daysAgo(49, 10),
    }),
    createMonitor({
        id: ids.monitors.database,
        groupId: ids.groups.data,
        name: "Primary PostgreSQL",
        type: "tcp",
        interval: 120,
        timeout: 20,
        retries: 3,
        retryInterval: 20,
        workerIds: euWorkerIds,
        config: {
            type: "tcp",
            hostname: "db-primary.uptimekit.demo",
            port: 5432,
        },
        successStatuses: null,
        incidentPendingDuration: 120,
        incidentRecoveryDuration: 300,
        createdAt: daysAgo(56, 10),
    }),
    createMonitor({
        id: ids.monitors.cache,
        groupId: ids.groups.data,
        name: "Redis cluster",
        type: "tcp",
        interval: 120,
        timeout: 20,
        retries: 2,
        retryInterval: 20,
        workerIds: euWorkerIds,
        config: {
            type: "tcp",
            hostname: "cache.uptimekit.demo",
            port: 6379,
        },
        successStatuses: null,
        createdAt: daysAgo(51, 10),
    }),
    createMonitor({
        id: ids.monitors.queue,
        groupId: ids.groups.messaging,
        name: "Background queue",
        type: "keyword",
        interval: 120,
        timeout: 30,
        retries: 2,
        retryInterval: 20,
        workerIds: [ids.workers.brussels, ids.workers.singapore],
        config: createHttpConfig("https://queue.uptimekit.demo/health", {
            type: "keyword",
            keyword: "ready",
        }),
        successStatuses: [200],
        createdAt: daysAgo(47, 10),
    }),
    createMonitor({
        id: ids.monitors.dns,
        groupId: ids.groups.platform,
        name: "Authoritative DNS",
        type: "dns",
        interval: 300,
        timeout: 20,
        retries: 2,
        retryInterval: 30,
        workerIds: allWorkerIds,
        config: {
            type: "dns",
            hostname: "uptimekit.demo",
            resolverServers: "1.1.1.1",
            port: 53,
            recordType: "A",
            expectedValue: "203.0.113.42",
        },
        successStatuses: null,
        createdAt: daysAgo(45, 10),
    }),
    createMonitor({
        id: ids.monitors.search,
        groupId: ids.groups.customer,
        name: "Search API",
        type: "http",
        interval: 120,
        timeout: 30,
        retries: 2,
        retryInterval: 20,
        workerIds: euWorkerIds,
        config: createHttpConfig("https://search.uptimekit.demo/health"),
        successStatuses: [200],
        createdAt: daysAgo(43, 10),
    }),
    createMonitor({
        id: ids.monitors.admin,
        groupId: ids.groups.platform,
        name: "Admin console",
        type: "http",
        interval: 300,
        timeout: 30,
        retries: 2,
        retryInterval: 30,
        workerIds: [ids.workers.brussels],
        config: createHttpConfig("https://admin.uptimekit.demo/"),
        successStatuses: [200],
        active: false,
        pauseReason: "Paused after the console migration",
        publishIncidentToStatusPage: false,
        createdAt: daysAgo(39, 10),
    }),
] satisfies Array<MonitorSeed>;

const monitorTags = [
    [ids.monitors.api, ids.tags.production],
    [ids.monitors.api, ids.tags.public],
    [ids.monitors.api, ids.tags.critical],
    [ids.monitors.web, ids.tags.production],
    [ids.monitors.web, ids.tags.public],
    [ids.monitors.web, ids.tags.critical],
    [ids.monitors.auth, ids.tags.production],
    [ids.monitors.auth, ids.tags.critical],
    [ids.monitors.checkout, ids.tags.production],
    [ids.monitors.checkout, ids.tags.public],
    [ids.monitors.ingest, ids.tags.production],
    [ids.monitors.ingest, ids.tags.internal],
    [ids.monitors.database, ids.tags.production],
    [ids.monitors.database, ids.tags.critical],
    [ids.monitors.database, ids.tags.internal],
    [ids.monitors.cache, ids.tags.internal],
    [ids.monitors.queue, ids.tags.internal],
    [ids.monitors.queue, ids.tags.regional],
    [ids.monitors.dns, ids.tags.production],
    [ids.monitors.dns, ids.tags.public],
    [ids.monitors.search, ids.tags.production],
    [ids.monitors.search, ids.tags.public],
    [ids.monitors.admin, ids.tags.internal],
].map(([monitorId, tagId]) => ({
    monitorId,
    tagId,
    createdAt: daysAgo(38, 11),
}));

const monitorNotifications = monitors
    .filter((item) => item.active)
    .map((item) => ({
        monitorId: item.id,
        integrationConfigId: ids.integrations.webhook,
        createdAt: daysAgo(37, 12),
    }));

const activeMaintenanceStart = minutesAgo(18);
const activeMaintenanceEnd = minutesAfter(activeMaintenanceStart, 90);
const scheduledMaintenanceStart = daysFromNow(2, 1, 30);
const scheduledMaintenanceEnd = hoursAfter(scheduledMaintenanceStart, 2.5);
const completedMaintenanceStart = daysAgo(16, 2, 0);
const completedMaintenanceEnd = hoursAfter(completedMaintenanceStart, 2);

const incidents = [
    {
        id: ids.incidents.api,
        organizationId: ids.organization,
        title: "Elevated API latency in Central Europe",
        description:
            "Requests from the Frankfurt region are slower than normal while traffic is being rebalanced between edge pools.",
        status: "monitoring",
        severity: "major",
        type: "automatic",
        acknowledgedAt: minutesAgo(58),
        acknowledgedBy: ids.user,
        startedAt: minutesAgo(75),
        endedAt: null,
        resolvedAt: null,
        createdAt: minutesAgo(75),
        updatedAt: minutesAgo(9),
        externalId: "pd-ns-20260806-1842",
        externalSource: "pagerduty",
    },
    {
        id: ids.incidents.checkout,
        organizationId: ids.organization,
        title: "Checkout returned intermittent 502 responses",
        description:
            "A deploy introduced a connection pool regression in the checkout API. The rollout was reverted and error rates returned to baseline.",
        status: "resolved",
        severity: "major",
        type: "automatic",
        acknowledgedAt: daysAgo(3, 9, 35),
        acknowledgedBy: ids.user,
        startedAt: daysAgo(3, 9, 12),
        endedAt: daysAgo(3, 10, 4),
        resolvedAt: daysAgo(3, 10, 4),
        createdAt: daysAgo(3, 9, 12),
        updatedAt: daysAgo(3, 10, 4),
        externalId: "pd-ns-20260803-0912",
        externalSource: "pagerduty",
    },
    {
        id: ids.incidents.database,
        organizationId: ids.organization,
        title: "Primary database failover",
        description:
            "The primary writer was promoted to the standby cluster after storage latency crossed the failover threshold. Writes were replayed successfully.",
        status: "resolved",
        severity: "critical",
        type: "automatic",
        acknowledgedAt: daysAgo(12, 4, 18),
        acknowledgedBy: ids.user,
        startedAt: daysAgo(12, 4, 5),
        endedAt: daysAgo(12, 4, 43),
        resolvedAt: daysAgo(12, 4, 43),
        createdAt: daysAgo(12, 4, 5),
        updatedAt: daysAgo(12, 4, 43),
        externalId: "pd-ns-20260725-0405",
        externalSource: "pagerduty",
    },
    {
        id: ids.incidents.queue,
        organizationId: ids.organization,
        title: "Webhook delivery backlog",
        description:
            "The outbound delivery queue exceeded its normal depth. Consumers were scaled up and delayed webhooks were drained without data loss.",
        status: "resolved",
        severity: "minor",
        type: "manual",
        acknowledgedAt: daysAgo(21, 16, 20),
        acknowledgedBy: ids.user,
        startedAt: daysAgo(21, 16, 0),
        endedAt: daysAgo(21, 17, 8),
        resolvedAt: daysAgo(21, 17, 8),
        createdAt: daysAgo(21, 16, 0),
        updatedAt: daysAgo(21, 17, 8),
        externalId: null,
        externalSource: null,
    },
] satisfies Array<typeof incident.$inferInsert>;

const incidentActivities = [
    {
        id: randomUUID(),
        incidentId: ids.incidents.api,
        message: "Frankfurt checks crossed the latency threshold.",
        type: "event",
        createdAt: minutesAgo(75),
        userId: null,
    },
    {
        id: randomUUID(),
        incidentId: ids.incidents.api,
        message:
            "Traffic has been shifted to the Brussels edge pool while the routing change is reviewed.",
        type: "comment",
        createdAt: minutesAgo(52),
        userId: ids.user,
    },
    {
        id: randomUUID(),
        incidentId: ids.incidents.api,
        message:
            "Error rate is back within the normal range. Keeping the incident open while latency settles.",
        type: "comment",
        createdAt: minutesAgo(9),
        userId: ids.user,
    },
    {
        id: randomUUID(),
        incidentId: ids.incidents.checkout,
        message: "The deploy was rolled back and 5xx responses stopped.",
        type: "comment",
        createdAt: daysAgo(3, 9, 43),
        userId: ids.user,
    },
    {
        id: randomUUID(),
        incidentId: ids.incidents.checkout,
        message: "Checkout error rate has returned to baseline.",
        type: "comment",
        createdAt: daysAgo(3, 10, 4),
        userId: ids.user,
    },
    {
        id: randomUUID(),
        incidentId: ids.incidents.database,
        message: "Standby promotion completed and write traffic is healthy.",
        type: "comment",
        createdAt: daysAgo(12, 4, 26),
        userId: ids.user,
    },
    {
        id: randomUUID(),
        incidentId: ids.incidents.database,
        message: "Replica lag cleared; incident resolved.",
        type: "comment",
        createdAt: daysAgo(12, 4, 43),
        userId: ids.user,
    },
    {
        id: randomUUID(),
        incidentId: ids.incidents.queue,
        message:
            "Consumer capacity was increased and the backlog began draining.",
        type: "comment",
        createdAt: daysAgo(21, 16, 35),
        userId: ids.user,
    },
] satisfies Array<typeof incidentActivity.$inferInsert>;

const maintenanceWindows = [
    {
        id: ids.maintenance.active,
        organizationId: ids.organization,
        title: "Rolling worker restart",
        description:
            "Monitoring workers are restarting one region at a time during a routine runtime upgrade. Checks may arrive a few minutes late.",
        status: "monitoring",
        severity: "maintenance",
        type: "manual",
        startedAt: activeMaintenanceStart,
        plannedEndAt: activeMaintenanceEnd,
        endedAt: null,
        resolvedAt: null,
        createdAt: activeMaintenanceStart,
        updatedAt: minutesAgo(4),
    },
    {
        id: ids.maintenance.scheduled,
        organizationId: ids.organization,
        title: "Database index maintenance",
        description:
            "High-cardinality indexes will be rebuilt on the read replicas during the low-traffic window.",
        status: "investigating",
        severity: "maintenance",
        type: "manual",
        startedAt: scheduledMaintenanceStart,
        plannedEndAt: scheduledMaintenanceEnd,
        endedAt: null,
        resolvedAt: null,
        createdAt: daysAgo(1, 11, 20),
        updatedAt: daysAgo(1, 11, 20),
    },
    {
        id: ids.maintenance.completed,
        organizationId: ids.organization,
        title: "Edge cache software update",
        description:
            "Edge cache nodes were upgraded region by region with no customer impact.",
        status: "resolved",
        severity: "maintenance",
        type: "manual",
        startedAt: completedMaintenanceStart,
        plannedEndAt: completedMaintenanceEnd,
        endedAt: completedMaintenanceEnd,
        resolvedAt: completedMaintenanceEnd,
        createdAt: completedMaintenanceStart,
        updatedAt: completedMaintenanceEnd,
    },
] satisfies Array<typeof incident.$inferInsert>;

const maintenanceActivities = [
    {
        id: randomUUID(),
        incidentId: ids.maintenance.active,
        message:
            "Brussels worker restarted successfully. Frankfurt is draining checks before its restart.",
        type: "comment",
        createdAt: minutesAgo(4),
        userId: ids.user,
    },
    {
        id: randomUUID(),
        incidentId: ids.maintenance.scheduled,
        message: "Maintenance is scheduled for the next low-traffic window.",
        type: "comment",
        createdAt: daysAgo(1, 11, 20),
        userId: ids.user,
    },
    {
        id: randomUUID(),
        incidentId: ids.maintenance.completed,
        message: "All edge regions completed the upgrade successfully.",
        type: "comment",
        createdAt: completedMaintenanceEnd,
        userId: ids.user,
    },
] satisfies Array<typeof incidentActivity.$inferInsert>;

function buildStatusPageMonitorLinks() {
    const links = [
        {
            monitorId: ids.monitors.api,
            groupId: ids.statusGroups.core,
            style: "history",
            description: "Public REST and GraphQL ingress.",
        },
        {
            monitorId: ids.monitors.web,
            groupId: ids.statusGroups.core,
            style: "history",
            description: "Customer-facing web application.",
        },
        {
            monitorId: ids.monitors.auth,
            groupId: ids.statusGroups.core,
            style: "status",
            description: "Login, session, and token services.",
        },
        {
            monitorId: ids.monitors.checkout,
            groupId: ids.statusGroups.core,
            style: "history",
            description: "Payment and order checkout endpoints.",
        },
        {
            monitorId: ids.monitors.database,
            groupId: ids.statusGroups.data,
            style: "history",
            description: "Primary write database endpoint.",
        },
        {
            monitorId: ids.monitors.cache,
            groupId: ids.statusGroups.data,
            style: "status",
            description: "Shared cache and session store.",
        },
        {
            monitorId: ids.monitors.queue,
            groupId: ids.statusGroups.data,
            style: "history",
            description: "Background delivery and job processing.",
        },
        {
            monitorId: ids.monitors.dns,
            groupId: ids.statusGroups.platform,
            style: "history",
            description: "Authoritative DNS resolution.",
        },
        {
            monitorId: ids.monitors.search,
            groupId: ids.statusGroups.platform,
            style: "history",
            description: "Product search query service.",
        },
    ];

    return links.map((link, order) => ({
        statusPageId: ids.statusPage,
        monitorId: link.monitorId,
        groupId: link.groupId,
        style: link.style,
        description: link.description,
        order,
    }));
}

const incidentMonitorLinks = [
    { incidentId: ids.incidents.api, monitorId: ids.monitors.api },
    { incidentId: ids.incidents.api, monitorId: ids.monitors.web },
    { incidentId: ids.incidents.checkout, monitorId: ids.monitors.checkout },
    { incidentId: ids.incidents.database, monitorId: ids.monitors.database },
    { incidentId: ids.incidents.queue, monitorId: ids.monitors.queue },
] satisfies Array<typeof incidentMonitor.$inferInsert>;

const maintenanceMonitorLinks = [
    { incidentId: ids.maintenance.active, monitorId: ids.monitors.queue },
    {
        incidentId: ids.maintenance.scheduled,
        monitorId: ids.monitors.database,
    },
    { incidentId: ids.maintenance.scheduled, monitorId: ids.monitors.api },
    {
        incidentId: ids.maintenance.completed,
        monitorId: ids.monitors.web,
    },
] satisfies Array<typeof incidentMonitor.$inferInsert>;

const incidentStatusPageLinks = [...incidents, ...maintenanceWindows].map(
    (item) => ({
        incidentId: item.id,
        statusPageId: ids.statusPage,
    }),
);

const statusPageReports = [
    {
        id: ids.reports.api,
        statusPageId: ids.statusPage,
        title: "Elevated API latency in Central Europe",
        status: "monitoring",
        severity: "major",
        createdAt: minutesAgo(75),
        resolvedAt: null,
        updatedAt: minutesAgo(9),
    },
    {
        id: ids.reports.database,
        statusPageId: ids.statusPage,
        title: "Database failover completed",
        status: "resolved",
        severity: "critical",
        createdAt: daysAgo(12, 4, 5),
        resolvedAt: daysAgo(12, 4, 43),
        updatedAt: daysAgo(12, 4, 43),
    },
    {
        id: ids.reports.queue,
        statusPageId: ids.statusPage,
        title: "Webhook delivery delays",
        status: "resolved",
        severity: "minor",
        createdAt: daysAgo(21, 16, 0),
        resolvedAt: daysAgo(21, 17, 8),
        updatedAt: daysAgo(21, 17, 8),
    },
] satisfies Array<typeof statusPageReport.$inferInsert>;

const statusPageReportUpdates = [
    {
        id: randomUUID(),
        reportId: ids.reports.api,
        message:
            "Traffic is being rebalanced away from the affected edge pool. Latency is improving and we are monitoring recovery.",
        status: "monitoring",
        createdAt: minutesAgo(9),
        userId: ids.user,
    },
    {
        id: randomUUID(),
        reportId: ids.reports.database,
        message:
            "The standby database is serving traffic normally. Replica lag has cleared and the incident is resolved.",
        status: "resolved",
        createdAt: daysAgo(12, 4, 43),
        userId: ids.user,
    },
    {
        id: randomUUID(),
        reportId: ids.reports.queue,
        message:
            "The delivery backlog has drained and all queued webhooks have been acknowledged.",
        status: "resolved",
        createdAt: daysAgo(21, 17, 8),
        userId: ids.user,
    },
] satisfies Array<typeof statusPageReportUpdate.$inferInsert>;

const statusPageReportMonitorLinks = [
    {
        reportId: ids.reports.api,
        monitorId: ids.monitors.api,
        status: "degraded",
    },
    {
        reportId: ids.reports.api,
        monitorId: ids.monitors.web,
        status: "degraded",
    },
    {
        reportId: ids.reports.database,
        monitorId: ids.monitors.database,
        status: "down",
    },
    {
        reportId: ids.reports.queue,
        monitorId: ids.monitors.queue,
        status: "degraded",
    },
] satisfies Array<typeof statusPageReportMonitor.$inferInsert>;

function getSeedWorkerIds(metadata: string | null) {
    if (!metadata) return [];

    try {
        const value: unknown = JSON.parse(metadata);
        if (
            typeof value === "object" &&
            value !== null &&
            "workerIds" in value &&
            Array.isArray(value.workerIds)
        ) {
            return value.workerIds.filter(
                (workerId): workerId is string => typeof workerId === "string",
            );
        }
    } catch {
        return [];
    }

    return [];
}

async function resetExistingDemoWorkspace() {
    const [existingOrganization] = await db
        .select({ id: organization.id, metadata: organization.metadata })
        .from(organization)
        .where(eq(organization.slug, DEMO.organizationSlug));
    const existingOrganizationIds = existingOrganization
        ? [existingOrganization.id]
        : [];

    const existingOrganizationMonitors = existingOrganization
        ? await db
              .select({ id: monitor.id })
              .from(monitor)
              .where(eq(monitor.organizationId, existingOrganization.id))
        : [];
    const existingMonitorIds = existingOrganizationMonitors.map(
        (item) => item.id,
    );

    if (existingMonitorIds.length > 0) {
        try {
            await timeseries.ping();
            for (const monitorId of existingMonitorIds) {
                await timeseries.deleteAllForMonitor(monitorId);
            }
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            console.warn(
                `Could not clear existing ${timeseries.backend} demo checks: ${message}`,
            );
        }
    }

    await db.transaction(async (tx) => {
        if (existingOrganizationIds.length > 0) {
            await tx
                .delete(organization)
                .where(inArray(organization.id, existingOrganizationIds));
        }

        const workerIds = existingOrganization
            ? getSeedWorkerIds(existingOrganization.metadata)
            : [];
        if (workerIds.length > 0) {
            await tx.delete(worker).where(inArray(worker.id, workerIds));
        }

        await tx.delete(user).where(eq(user.email, DEMO.email));
    });
}

function statusForEvent(input: {
    monitorId: string;
    workerId: string;
    timestamp: Date;
}) {
    const { monitorId, workerId, timestamp } = input;
    const time = timestamp.getTime();

    const apiIncidentStart = minutesAgo(75).getTime();
    const apiIncidentDownUntil = minutesAgo(43).getTime();
    const apiIncidentWorker = ids.workers.frankfurt;

    if (monitorId === ids.monitors.api && workerId === apiIncidentWorker) {
        if (time >= apiIncidentStart && time <= apiIncidentDownUntil) {
            return "down";
        }

        if (time > apiIncidentDownUntil) {
            return "degraded";
        }
    }

    if (
        monitorId === ids.monitors.queue &&
        time >= activeMaintenanceStart.getTime() &&
        time <= activeMaintenanceEnd.getTime()
    ) {
        return "maintenance";
    }

    const databaseIncidentStart = daysAgo(12, 4, 5).getTime();
    const databaseIncidentEnd = daysAgo(12, 4, 43).getTime();
    if (
        monitorId === ids.monitors.database &&
        workerId === ids.workers.brussels &&
        time >= databaseIncidentStart &&
        time <= databaseIncidentEnd
    ) {
        return "down";
    }

    const checkoutIncidentStart = daysAgo(3, 9, 12).getTime();
    const checkoutIncidentEnd = daysAgo(3, 10, 4).getTime();
    if (
        monitorId === ids.monitors.checkout &&
        time >= checkoutIncidentStart &&
        time <= checkoutIncidentEnd
    ) {
        return time <= daysAgo(3, 9, 36).getTime() ? "down" : "degraded";
    }

    const searchIncidentStart = daysAgo(6, 14, 10).getTime();
    const searchIncidentEnd = daysAgo(6, 15, 5).getTime();
    if (
        monitorId === ids.monitors.search &&
        time >= searchIncidentStart &&
        time <= searchIncidentEnd
    ) {
        return "degraded";
    }

    const queueIncidentStart = daysAgo(21, 16).getTime();
    const queueIncidentEnd = daysAgo(21, 17, 8).getTime();
    if (
        monitorId === ids.monitors.queue &&
        time >= queueIncidentStart &&
        time <= queueIncidentEnd
    ) {
        return "degraded";
    }

    return "up";
}

function baseLatencyForMonitor(monitorId: string) {
    switch (monitorId) {
        case ids.monitors.web:
            return 185;
        case ids.monitors.checkout:
            return 142;
        case ids.monitors.api:
            return 74;
        case ids.monitors.auth:
            return 61;
        case ids.monitors.ingest:
            return 86;
        case ids.monitors.database:
            return 34;
        case ids.monitors.cache:
            return 12;
        case ids.monitors.queue:
            return 103;
        case ids.monitors.dns:
            return 24;
        case ids.monitors.search:
            return 96;
        case ids.monitors.admin:
            return 128;
        default:
            return 80;
    }
}

function latencyForEvent(
    status: string,
    baseLatency: number,
    variation: number,
) {
    if (status === "down") return 0;
    if (status === "maintenance") {
        return Math.max(1, Math.round(baseLatency * 0.9 + variation));
    }
    if (status === "degraded") {
        return Math.max(1, Math.round(baseLatency * 2.8 + variation * 2));
    }

    return Math.max(1, Math.round(baseLatency + variation));
}

function buildTimeSeriesSeed() {
    const events: MonitorEventInsert[] = [];
    const changes: MonitorChangeInsert[] = [];
    const previousStatus = new Map<string, string>();
    const start = new Date(now.getTime() - HISTORY_DAYS * 24 * 60 * 60_000);
    start.setUTCSeconds(0, 0);

    const monitorsWithHistory = monitors.filter(
        (monitorRecord) => monitorRecord.workerIds.length > 0,
    );
    const httpMonitorTypes = new Set(["http", "http-json", "keyword"]);

    for (const [monitorIndex, monitorRecord] of monitorsWithHistory.entries()) {
        const baseLatency = baseLatencyForMonitor(monitorRecord.id);
        const workerIds = monitorRecord.workerIds as string[];

        for (
            let timestamp = new Date(start);
            timestamp.getTime() <= now.getTime();
            timestamp = new Date(
                timestamp.getTime() + CHECK_INTERVAL_MINUTES * 60_000,
            )
        ) {
            for (const [workerIndex, workerId] of workerIds.entries()) {
                const status = statusForEvent({
                    monitorId: monitorRecord.id,
                    workerId,
                    timestamp,
                });
                const wave =
                    Math.sin(
                        timestamp.getTime() / 60_000 / 11 +
                            monitorIndex * 1.8 +
                            workerIndex * 2.4,
                    ) * 0.11;
                const regionalOffset =
                    workerId === ids.workers.frankfurt
                        ? 12
                        : workerId === ids.workers.singapore
                          ? 48
                          : 0;
                const variation = Math.round(
                    baseLatency * wave + regionalOffset,
                );
                const latency = latencyForEvent(status, baseLatency, variation);
                const isHttp = httpMonitorTypes.has(monitorRecord.type);
                const isDns = monitorRecord.type === "dns";
                const isTcp = monitorRecord.type === "tcp";
                const isDown = status === "down";
                const eventKey = `${monitorRecord.id}:${workerId}`;

                events.push({
                    id: randomUUID(),
                    monitorId: monitorRecord.id,
                    status,
                    latency,
                    timestamp,
                    statusCode: isHttp ? (isDown ? 503 : 200) : null,
                    error: isDown
                        ? isTcp
                            ? "Connection timed out"
                            : "Upstream returned an error"
                        : null,
                    location: workerId,
                    dnsLookup:
                        isDown || (!isHttp && !isDns)
                            ? null
                            : Math.max(3, Math.round(latency * 0.08)),
                    tcpConnect:
                        isDown || (!isHttp && !isTcp)
                            ? null
                            : Math.max(4, Math.round(latency * 0.12)),
                    tlsHandshake:
                        isDown || !isHttp
                            ? null
                            : Math.max(6, Math.round(latency * 0.18)),
                    ttfb:
                        isDown || !isHttp
                            ? null
                            : Math.max(8, Math.round(latency * 0.45)),
                    transfer:
                        isDown || !isHttp
                            ? null
                            : Math.max(3, Math.round(latency * 0.17)),
                });

                if (previousStatus.get(eventKey) !== status) {
                    changes.push({
                        id: randomUUID(),
                        monitorId: monitorRecord.id,
                        status,
                        timestamp,
                        location: workerId,
                    });
                    previousStatus.set(eventKey, status);
                }
            }
        }
    }

    return { events, changes };
}

async function insertTimeSeriesInChunks<T>(
    items: T[],
    insertChunk: (chunk: T[]) => Promise<void>,
) {
    for (
        let index = 0;
        index < items.length;
        index += TIMESERIES_INSERT_CHUNK_SIZE
    ) {
        await insertChunk(
            items.slice(index, index + TIMESERIES_INSERT_CHUNK_SIZE),
        );
    }
}

async function seedRelationalData(
    passwordHash: string,
    rawOrganizationApiKey: string,
    workerKeys: Record<string, string>,
) {
    await db.transaction(async (tx) => {
        await tx.insert(user).values({
            id: ids.user,
            name: "Avery Morgan",
            email: DEMO.email,
            emailVerified: true,
            image: null,
            role: "admin",
            banned: false,
            twoFactorEnabled: false,
            createdAt: daysAgo(61, 8),
            updatedAt: now,
        });

        await tx.insert(account).values({
            id: ids.account,
            accountId: ids.user,
            providerId: "credential",
            userId: ids.user,
            password: passwordHash,
            createdAt: daysAgo(61, 8),
            updatedAt: now,
        });

        await tx.insert(organization).values({
            id: ids.organization,
            name: DEMO.organizationName,
            slug: DEMO.organizationSlug,
            logo: null,
            activeMonitorLimit: 50,
            regionsPerMonitorLimit: 3,
            createdAt: daysAgo(61, 8),
            metadata: JSON.stringify({
                plan: "scale",
                billingStatus: "active",
                source: "demo",
                workerIds: allWorkerIds,
            }),
        });

        await tx.insert(member).values({
            id: ids.member,
            organizationId: ids.organization,
            userId: ids.user,
            role: "owner",
            createdAt: daysAgo(61, 8),
        });

        await tx.insert(worker).values(workers);
        await tx.insert(workerApiKey).values([
            {
                id: ids.workerApiKeys.brussels,
                keyHash: hashWorkerApiKey(workerKeys.brussels),
                keyHint: `${workerKeys.brussels.slice(0, 11)}...`,
                workerId: ids.workers.brussels,
                createdAt: daysAgo(60, 8),
                lastUsedAt: minutesAgo(1),
            },
            {
                id: ids.workerApiKeys.frankfurt,
                keyHash: hashWorkerApiKey(workerKeys.frankfurt),
                keyHint: `${workerKeys.frankfurt.slice(0, 11)}...`,
                workerId: ids.workers.frankfurt,
                createdAt: daysAgo(59, 8),
                lastUsedAt: minutesAgo(2),
            },
            {
                id: ids.workerApiKeys.singapore,
                keyHash: hashWorkerApiKey(workerKeys.singapore),
                keyHint: `${workerKeys.singapore.slice(0, 11)}...`,
                workerId: ids.workers.singapore,
                createdAt: daysAgo(57, 8),
                lastUsedAt: minutesAgo(3),
            },
        ]);

        await tx.insert(apikey).values({
            id: ids.apiKey,
            configId: "default",
            name: "Production automation",
            start: rawOrganizationApiKey.slice(0, 6),
            prefix: "uk_api_",
            key: hashBetterAuthApiKey(rawOrganizationApiKey),
            referenceId: ids.organization,
            enabled: true,
            rateLimitEnabled: true,
            rateLimitTimeWindow: 60_000,
            rateLimitMax: 120,
            requestCount: 8,
            remaining: 112,
            lastRequest: minutesAgo(27),
            createdAt: daysAgo(33, 13),
            updatedAt: now,
            permissions: JSON.stringify({
                monitor: ["read"],
                statusPage: ["read"],
            }),
            metadata: JSON.stringify({
                owner: "platform",
                environment: "production",
            }),
        });

        await tx.insert(monitorGroup).values(groups);
        await tx.insert(tag).values(tags);
        await tx.insert(integrationConfig).values(integrations);
        await tx.insert(monitor).values(monitors);
        await tx.insert(monitorTag).values(monitorTags);
        await tx.insert(monitorNotification).values(monitorNotifications);

        await tx.insert(statusPage).values({
            id: ids.statusPage,
            organizationId: ids.organization,
            name: DEMO.statusPageName,
            slug: DEMO.statusPageSlug,
            domain: null,
            description:
                "Live service health and incident history for uptimekit Cloud.",
            public: true,
            password: null,
            design: {
                themeId: "spark",
                theme: "dark",
                headerLayout: "horizontal",
                barStyle: "length",
                barDays: 90,
                percentDigits: 2,
                allowSubscriptions: true,
                defaultSectionCollapsible: true,
                defaultSectionCollapsed: false,
                websiteUrl: "https://uptimekit.demo",
                contactUrl: "mailto:status@uptimekit.demo",
            },
            createdAt: daysAgo(60, 9),
            updatedAt: now,
        });
        await tx.insert(statusPageGroup).values([
            {
                id: ids.statusGroups.core,
                statusPageId: ids.statusPage,
                name: "Core services",
                order: 0,
                collapsible: true,
                defaultCollapsed: false,
            },
            {
                id: ids.statusGroups.data,
                statusPageId: ids.statusPage,
                name: "Data & messaging",
                order: 1,
                collapsible: true,
                defaultCollapsed: false,
            },
            {
                id: ids.statusGroups.platform,
                statusPageId: ids.statusPage,
                name: "Platform operations",
                order: 2,
                collapsible: true,
                defaultCollapsed: false,
            },
        ]);
        await tx
            .insert(statusPageMonitor)
            .values(buildStatusPageMonitorLinks());

        await tx.insert(incident).values([...incidents, ...maintenanceWindows]);
        await tx
            .insert(incidentMonitor)
            .values([...incidentMonitorLinks, ...maintenanceMonitorLinks]);
        await tx.insert(incidentStatusPage).values(incidentStatusPageLinks);
        await tx
            .insert(incidentActivity)
            .values([...incidentActivities, ...maintenanceActivities]);

        await tx.insert(statusPageReport).values(statusPageReports);
        await tx.insert(statusPageReportUpdate).values(statusPageReportUpdates);
        await tx
            .insert(statusPageReportMonitor)
            .values(statusPageReportMonitorLinks);

        await tx.insert(statusPageEmailSubscribers).values([
            {
                statusPageId: ids.statusPage,
                email: "on-call@uptimekit.demo",
                createdAt: daysAgo(28, 8),
            },
            {
                statusPageId: ids.statusPage,
                email: "platform@uptimekit.demo",
                createdAt: daysAgo(20, 8),
            },
            {
                statusPageId: ids.statusPage,
                email: "status-updates@uptimekit.demo",
                createdAt: daysAgo(7, 8),
            },
        ]);

        await tx.insert(sslCertificateNotification).values([
            {
                id: ids.ssl.web,
                monitorId: ids.monitors.web,
                domain: "app.uptimekit.demo",
                lastNotifiedAt: daysAgo(4, 7),
                daysUntilExpiryAtNotification: "21",
                createdAt: daysAgo(30, 7),
                updatedAt: now,
            },
            {
                id: ids.ssl.api,
                monitorId: ids.monitors.api,
                domain: "api.uptimekit.demo",
                lastNotifiedAt: daysAgo(12, 7),
                daysUntilExpiryAtNotification: "30",
                createdAt: daysAgo(30, 7),
                updatedAt: now,
            },
        ]);

        await tx
            .insert(configuration)
            .values({
                id: ids.configuration.instanceName,
                key: "instance_name",
                value: DEMO.organizationName,
                createdAt: now,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: configuration.key,
                set: {
                    value: DEMO.organizationName,
                    updatedAt: now,
                },
            });
        await tx
            .insert(configuration)
            .values({
                id: ids.configuration.retention,
                key: "data_retention_days",
                value: "90",
                createdAt: now,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: configuration.key,
                set: {
                    value: "90",
                    updatedAt: now,
                },
            });
    });
}

async function seedTimeSeries() {
    try {
        await timeseries.ping();

        const { events, changes } = buildTimeSeriesSeed();
        await insertTimeSeriesInChunks(events, (chunk) =>
            timeseries.insertMonitorEvents(chunk),
        );
        await insertTimeSeriesInChunks(changes, (chunk) =>
            timeseries.insertMonitorChanges(chunk),
        );

        console.log(
            `Seeded ${events.length.toLocaleString()} monitor checks and ${changes.length.toLocaleString()} status changes in ${timeseries.backend}.`,
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
            `Skipped historical checks because ${timeseries.backend} is not reachable: ${message}`,
        );
    }
}

async function verifySeed() {
    const [monitorCount, incidentCount, maintenanceCount, reportCount] =
        await Promise.all([
            db.$count(monitor, eq(monitor.organizationId, ids.organization)),
            db.$count(incident, eq(incident.organizationId, ids.organization)),
            db.$count(
                incident,
                and(
                    eq(incident.organizationId, ids.organization),
                    eq(incident.severity, "maintenance"),
                ),
            ),
            db.$count(
                statusPageReport,
                eq(statusPageReport.statusPageId, ids.statusPage),
            ),
        ]);

    console.log(
        `Verified ${monitorCount} monitors, ${incidentCount} incidents, ${maintenanceCount} maintenance windows, and ${reportCount} public updates.`,
    );
}

async function main() {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not defined.");
    }

    console.log(`Seeding ${DEMO.organizationName} with fresh UUIDs...`);
    await resetExistingDemoWorkspace();

    const passwordHash = await hashPassword(DEMO.password);
    const rawOrganizationApiKey = generateOrganizationApiKey();
    const workerKeys = {
        brussels: generateWorkerApiKey(),
        frankfurt: generateWorkerApiKey(),
        singapore: generateWorkerApiKey(),
    };

    await seedRelationalData(passwordHash, rawOrganizationApiKey, workerKeys);
    console.log("Seeded workspace, monitors, incidents, and status page data.");

    await seedTimeSeries();
    await verifySeed();

    console.log("Demo login:");
    console.log(`  Email: ${DEMO.email}`);
    console.log(`  Password: ${DEMO.password}`);
    console.log(`  Status page: /status/${DEMO.statusPageSlug}`);
}

(async () => {
    try {
        await main();
    } finally {
        await timeseries.close().catch(() => undefined);
        await postgresClient.end();
    }
})();
