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
    invitation,
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

// Every hostname uses the reserved .example TLD (RFC 2606) so a real worker
// pointed at the demo data never probes someone else's infrastructure.
const DEMO = {
    email: process.env.DEMO_EMAIL?.trim() || "demo@acme.example",
    password: process.env.DEMO_PASSWORD || "DemoPassword123!",
    organizationName: "Acme Inc.",
    organizationSlug: process.env.DEMO_ORG_SLUG?.trim() || "acme",
    statusPageName: "Acme",
    statusPageSlug: process.env.DEMO_STATUS_PAGE_SLUG?.trim() || "acme-status",
    internalStatusPagePassword: "acme-internal",
    // Precomputed argon2id hash of "acme-internal", so the seed bundle needs no
    // native argon2 module at runtime.
    internalStatusPagePasswordHash:
        "$argon2id$v=19$m=65536,t=3,p=4$Pl7Fs0p5nRYZPAuGkws8Sg$tmgoD5LAC8WdK82fTjQ4kaHZ5Ht9l5BdrrmDvYOVSDI",
};

const teammates = [
    {
        userId: randomUUID(),
        memberId: randomUUID(),
        name: "Jordan Lee",
        email: "jordan@acme.example",
        role: "admin",
    },
    {
        userId: randomUUID(),
        memberId: randomUUID(),
        name: "Sam Rivera",
        email: "sam@acme.example",
        role: "member",
    },
] as const;

const [jordan, sam] = teammates;

const ALL_NOTIFICATION_EVENTS = [
    "incident.created",
    "incident.updated",
    "incident.resolved",
    "incident.acknowledged",
    "incident.comment_added",
    "incident.merged",
    "incident.deleted",
    "monitor.ssl.expiring",
];

const HISTORY_DAYS = 30;
const CHECK_INTERVAL_MINUTES = 5;
const TIMESERIES_INSERT_CHUNK_SIZE = 2_000;

const now = new Date();

const ids = {
    user: randomUUID(),
    account: randomUUID(),
    organization: randomUUID(),
    member: randomUUID(),
    invitation: randomUUID(),
    apiKey: randomUUID(),
    workers: {
        brussels: randomUUID(),
        frankfurt: randomUUID(),
        singapore: randomUUID(),
        virginia: randomUUID(),
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
        vendor: randomUUID(),
    },
    integrations: {
        webhook: randomUUID(),
        ntfy: randomUUID(),
        discord: randomUUID(),
        telegram: randomUUID(),
        gchat: randomUUID(),
        smtp: randomUUID(),
        apprise: randomUUID(),
        alertmanager: randomUUID(),
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
        vpn: randomUUID(),
        statusVendor: randomUUID(),
    },
    statusPages: {
        public: randomUUID(),
        developers: randomUUID(),
        europe: randomUUID(),
        internal: randomUUID(),
    },
    incidents: {
        api: randomUUID(),
        ingest: randomUUID(),
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
    [ids.workers.virginia]: "us",
} satisfies Record<string, string>;

// Virginia is deliberately offline and assigned to no monitor, so its stale
// heartbeat never contradicts fresh check results.
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
    {
        id: ids.workers.virginia,
        name: "Virginia · US East",
        location: "us",
        active: true,
        lastHeartbeat: daysAgo(2, 6, 40),
        version: "4.2.1",
        createdAt: daysAgo(20, 8),
        updatedAt: daysAgo(2, 6, 40),
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
    {
        id: ids.tags.vendor,
        organizationId: ids.organization,
        name: "Third-party",
        color: "#64748b",
        createdAt: daysAgo(30, 10),
        updatedAt: now,
    },
] satisfies Array<typeof tag.$inferInsert>;

function createIntegration(input: {
    id: string;
    name: string;
    type: string;
    config: Record<string, unknown>;
    active?: boolean;
    isDefault?: boolean;
    enabledEvents?: string[];
    createdAt: Date;
}) {
    return {
        organizationId: ids.organization,
        active: false,
        isDefault: false,
        enabledEvents: ALL_NOTIFICATION_EVENTS,
        updatedAt: now,
        ...input,
    } satisfies typeof integrationConfig.$inferInsert;
}

// Only the .example webhook is active: demo visitors can create incidents, and
// the chat/email integrations would otherwise send to real third-party APIs.
const integrations = [
    createIntegration({
        id: ids.integrations.webhook,
        name: "Incident webhook",
        type: "webhook",
        config: {
            url: "https://hooks.acme.example/uptimekit",
            secret: randomBytes(24).toString("hex"),
        },
        active: true,
        isDefault: true,
        createdAt: daysAgo(42, 11),
    }),
    createIntegration({
        id: ids.integrations.discord,
        name: "#incidents on Discord",
        type: "discord",
        config: {
            webhookUrl: `https://discord.com/api/webhooks/000000000000000000/${randomBytes(24).toString("hex")}`,
        },
        createdAt: daysAgo(40, 10),
    }),
    createIntegration({
        id: ids.integrations.gchat,
        name: "Support team Google Chat",
        type: "gchat",
        config: {
            webhookUrl:
                "https://chat.googleapis.com/v1/spaces/ACME_DEMO/messages?key=demo&token=demo",
        },
        createdAt: daysAgo(36, 15),
    }),
    createIntegration({
        id: ids.integrations.telegram,
        name: "On-call Telegram",
        type: "telegram",
        config: {
            botToken: "000000000:acme-demo-token",
            chatId: "-1000000000000",
        },
        enabledEvents: ["incident.created", "incident.resolved"],
        createdAt: daysAgo(35, 9),
    }),
    createIntegration({
        id: ids.integrations.ntfy,
        name: "Phone push via ntfy",
        type: "ntfy",
        config: {
            serverUrl: "https://ntfy.acme.example",
            topic: "acme-ops",
            priority: "high",
            tags: "warning,rotating_light",
        },
        enabledEvents: ["incident.created", "incident.resolved"],
        createdAt: daysAgo(38, 14),
    }),
    createIntegration({
        id: ids.integrations.smtp,
        name: "Engineering email digest",
        type: "smtp",
        config: {
            host: "smtp.acme.example",
            port: 587,
            secure: "auto",
            username: "alerts",
            password: "demo-password",
            from: "alerts@acme.example",
            to: "engineering@acme.example, cto@acme.example",
        },
        createdAt: daysAgo(31, 12),
    }),
    createIntegration({
        id: ids.integrations.apprise,
        name: "Apprise relay",
        type: "apprise",
        config: {
            notifyUrl: "mailto://alerts:demo@acme.example",
        },
        createdAt: daysAgo(18, 12),
    }),
    createIntegration({
        id: ids.integrations.alertmanager,
        name: "Prometheus Alertmanager",
        type: "alertmanager",
        config: {
            bearerToken: randomBytes(24).toString("hex"),
            autoResolve: true,
            defaultSeverity: "minor",
            titleTemplate: "Alert: {{alertname}}",
        },
        active: true,
        enabledEvents: [],
        createdAt: daysAgo(26, 10),
    }),
];

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
        config: createHttpConfig("https://api.acme.example/health"),
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
        config: createHttpConfig("https://app.acme.example/"),
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
        config: createHttpConfig("https://auth.acme.example/health", {
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
        config: createHttpConfig("https://checkout.acme.example/ready"),
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
        config: createHttpConfig("https://events.acme.example/health"),
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
            hostname: "db-primary.acme.example",
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
            hostname: "cache.acme.example",
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
        config: createHttpConfig("https://queue.acme.example/health", {
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
            hostname: "acme.example",
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
        config: createHttpConfig("https://search.acme.example/health"),
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
        config: createHttpConfig("https://admin.acme.example/"),
        successStatuses: [200],
        active: false,
        pauseReason: "Paused after the console migration",
        publishIncidentToStatusPage: false,
        createdAt: daysAgo(39, 10),
    }),
    createMonitor({
        id: ids.monitors.vpn,
        groupId: ids.groups.platform,
        name: "Office VPN gateway",
        type: "ping",
        interval: 60,
        timeout: 10,
        retries: 3,
        retryInterval: 10,
        workerIds: euWorkerIds,
        config: { type: "ping", hostname: "vpn.acme.example" },
        publishIncidentToStatusPage: false,
        createdAt: daysAgo(33, 10),
    }),
    // shortcut: reads the live public Instatus page, so its status follows
    // Instatus rather than the seed; swap the URL if that page ever goes away.
    createMonitor({
        id: ids.monitors.statusVendor,
        groupId: ids.groups.platform,
        name: "Instatus website",
        type: "instatus",
        interval: 300,
        timeout: 30,
        retries: 0,
        retryInterval: 60,
        workerIds: [],
        config: {
            type: "instatus",
            url: "https://status.instatus.com",
            componentId: "cktptd80w1445657roplsuitq7n",
            hostname: "Website",
        },
        publishIncidentToStatusPage: false,
        createdAt: daysAgo(14, 10),
    }),
] satisfies Array<MonitorSeed>;

const monitorTags = (
    [
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
        [ids.monitors.vpn, ids.tags.internal],
        [ids.monitors.statusVendor, ids.tags.vendor],
    ] satisfies Array<[string, string]>
).map(([monitorId, tagId]) => ({
    monitorId,
    tagId,
    createdAt: daysAgo(38, 11),
}));

const criticalMonitorIds = [
    ids.monitors.api,
    ids.monitors.web,
    ids.monitors.auth,
    ids.monitors.database,
];

const monitorNotifications = [
    ...monitors
        .filter((item) => item.active)
        .map((item) => ({
            monitorId: item.id,
            integrationConfigId: ids.integrations.webhook,
            createdAt: daysAgo(37, 12),
        })),
    ...criticalMonitorIds.flatMap((monitorId) =>
        [ids.integrations.discord, ids.integrations.telegram].map(
            (integrationConfigId) => ({
                monitorId,
                integrationConfigId,
                createdAt: daysAgo(34, 12),
            }),
        ),
    ),
];

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
        externalId: null,
        externalSource: null,
    },
    {
        id: ids.incidents.ingest,
        organizationId: ids.organization,
        title: "Alert: IngestWorkerMemoryHigh",
        description:
            "Prometheus reports ingest workers in Singapore above 90% memory. Event ingestion latency is elevated in Asia Pacific.",
        status: "investigating",
        severity: "minor",
        type: "automatic",
        acknowledgedAt: null,
        acknowledgedBy: null,
        startedAt: minutesAgo(22),
        endedAt: null,
        resolvedAt: null,
        createdAt: minutesAgo(22),
        updatedAt: minutesAgo(22),
        externalId: "a3f1c9e2b7d04f61",
        externalSource: "alertmanager",
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
        acknowledgedBy: jordan.userId,
        startedAt: daysAgo(3, 9, 12),
        endedAt: daysAgo(3, 10, 4),
        resolvedAt: daysAgo(3, 10, 4),
        createdAt: daysAgo(3, 9, 12),
        updatedAt: daysAgo(3, 10, 4),
        externalId: null,
        externalSource: null,
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
        externalId: null,
        externalSource: null,
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
        acknowledgedBy: sam.userId,
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
        incidentId: ids.incidents.ingest,
        message:
            "Incident opened by Prometheus Alertmanager (alertname=IngestWorkerMemoryHigh, region=ap-southeast-1).",
        type: "event",
        createdAt: minutesAgo(22),
        userId: null,
    },
    {
        id: randomUUID(),
        incidentId: ids.incidents.checkout,
        message: "The deploy was rolled back and 5xx responses stopped.",
        type: "comment",
        createdAt: daysAgo(3, 9, 43),
        userId: jordan.userId,
    },
    {
        id: randomUUID(),
        incidentId: ids.incidents.checkout,
        message: "Checkout error rate has returned to baseline.",
        type: "comment",
        createdAt: daysAgo(3, 10, 4),
        userId: jordan.userId,
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
        userId: sam.userId,
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

type StatusPageMonitorSeed = {
    monitorId: string;
    style: "history" | "status";
    description: string;
};

type StatusPageSeed = {
    id: string;
    name: string;
    slug: string;
    description: string;
    passwordProtected?: boolean;
    design: Record<string, unknown>;
    groups: Array<{
        name: string;
        defaultCollapsed?: boolean;
        monitors: StatusPageMonitorSeed[];
    }>;
};

const statusPageMonitors = {
    api: {
        monitorId: ids.monitors.api,
        style: "history",
        description: "Public REST and GraphQL ingress.",
    },
    web: {
        monitorId: ids.monitors.web,
        style: "history",
        description: "Customer-facing web application.",
    },
    auth: {
        monitorId: ids.monitors.auth,
        style: "status",
        description: "Login, session, and token services.",
    },
    checkout: {
        monitorId: ids.monitors.checkout,
        style: "history",
        description: "Payment and order checkout endpoints.",
    },
    ingest: {
        monitorId: ids.monitors.ingest,
        style: "history",
        description: "Event and analytics ingestion endpoint.",
    },
    database: {
        monitorId: ids.monitors.database,
        style: "history",
        description: "Primary write database endpoint.",
    },
    cache: {
        monitorId: ids.monitors.cache,
        style: "status",
        description: "Shared cache and session store.",
    },
    queue: {
        monitorId: ids.monitors.queue,
        style: "history",
        description: "Background delivery and job processing.",
    },
    dns: {
        monitorId: ids.monitors.dns,
        style: "history",
        description: "Authoritative DNS resolution.",
    },
    search: {
        monitorId: ids.monitors.search,
        style: "history",
        description: "Product search query service.",
    },
    vpn: {
        monitorId: ids.monitors.vpn,
        style: "status",
        description: "Office VPN gateway reachability (ICMP).",
    },
    statusVendor: {
        monitorId: ids.monitors.statusVendor,
        style: "status",
        description: "Live component status pulled from Instatus.",
    },
} satisfies Record<string, StatusPageMonitorSeed>;

// One page per theme so every theme and design option is visible out of the box.
const statusPages: StatusPageSeed[] = [
    {
        id: ids.statusPages.public,
        name: DEMO.statusPageName,
        slug: DEMO.statusPageSlug,
        description: "Live service health and incident history for Acme.",
        design: {
            themeId: "default",
            theme: "dark",
            headerLayout: "vertical",
            barStyle: "length",
            barDays: 90,
            percentDigits: 2,
            allowSubscriptions: true,
            defaultSectionCollapsible: true,
            defaultSectionCollapsed: false,
            websiteUrl: "https://acme.example",
            contactUrl: "mailto:status@acme.example",
        },
        groups: [
            {
                name: "Core services",
                monitors: [
                    statusPageMonitors.api,
                    statusPageMonitors.web,
                    statusPageMonitors.auth,
                    statusPageMonitors.checkout,
                ],
            },
            {
                name: "Data & messaging",
                monitors: [
                    statusPageMonitors.database,
                    statusPageMonitors.cache,
                    statusPageMonitors.queue,
                ],
            },
            {
                name: "Platform",
                monitors: [statusPageMonitors.dns, statusPageMonitors.search],
            },
        ],
    },
    {
        id: ids.statusPages.developers,
        name: "Acme Developer Platform",
        slug: "acme-developers",
        description: "API, auth, and ingestion health for integrators.",
        design: {
            themeId: "flat",
            theme: "dark",
            headerLayout: "horizontal",
            barStyle: "normal",
            barDays: 30,
            percentDigits: 3,
            allowSubscriptions: false,
            defaultSectionCollapsible: false,
            defaultSectionCollapsed: false,
            websiteUrl: "https://developers.acme.example",
            contactUrl: "https://developers.acme.example/support",
            customCss: ":root { --radius: 0.25rem; }",
        },
        groups: [
            {
                name: "APIs",
                monitors: [
                    statusPageMonitors.api,
                    statusPageMonitors.auth,
                    statusPageMonitors.ingest,
                ],
            },
        ],
    },
    {
        id: ids.statusPages.europe,
        name: "Acme EU",
        slug: "acme-eu",
        description: "Service health for the EU region.",
        design: {
            themeId: "spark",
            theme: "dark",
            barStyle: "normal",
            barDays: 60,
            percentDigits: 2,
            allowSubscriptions: true,
            defaultSectionCollapsible: true,
            defaultSectionCollapsed: false,
            websiteUrl: "https://acme.example/eu",
        },
        groups: [
            {
                name: "EU services",
                monitors: [
                    statusPageMonitors.api,
                    statusPageMonitors.checkout,
                    statusPageMonitors.database,
                ],
            },
        ],
    },
    {
        id: ids.statusPages.internal,
        name: "Acme Internal",
        slug: "acme-internal",
        description: "Internal infrastructure and vendor status for staff.",
        passwordProtected: true,
        design: {
            themeId: "signal",
            theme: "dark",
            barStyle: "signal",
            barDays: 30,
            percentDigits: 2,
            allowSubscriptions: false,
            defaultSectionCollapsible: true,
            defaultSectionCollapsed: true,
        },
        groups: [
            {
                name: "Infrastructure",
                defaultCollapsed: false,
                monitors: [
                    statusPageMonitors.database,
                    statusPageMonitors.cache,
                    statusPageMonitors.queue,
                    statusPageMonitors.ingest,
                    statusPageMonitors.vpn,
                ],
            },
            {
                name: "Vendors",
                monitors: [statusPageMonitors.statusVendor],
            },
        ],
    },
];

function buildStatusPageRows() {
    const pages = statusPages.map((page) => ({
        id: page.id,
        organizationId: ids.organization,
        name: page.name,
        slug: page.slug,
        domain: null,
        description: page.description,
        public: !page.passwordProtected,
        password: page.passwordProtected
            ? DEMO.internalStatusPagePasswordHash
            : null,
        design: page.design,
        createdAt: daysAgo(60, 9),
        updatedAt: now,
    }));
    const groupRows: Array<typeof statusPageGroup.$inferInsert> = [];
    const monitorRows: Array<typeof statusPageMonitor.$inferInsert> = [];

    for (const page of statusPages) {
        let monitorOrder = 0;
        for (const [groupOrder, group] of page.groups.entries()) {
            const groupId = randomUUID();
            groupRows.push({
                id: groupId,
                statusPageId: page.id,
                name: group.name,
                order: groupOrder,
                collapsible: true,
                defaultCollapsed:
                    group.defaultCollapsed ??
                    page.design.defaultSectionCollapsed === true,
            });
            for (const link of group.monitors) {
                monitorRows.push({
                    statusPageId: page.id,
                    groupId,
                    ...link,
                    order: monitorOrder++,
                });
            }
        }
    }

    return { pages, groupRows, monitorRows };
}

const incidentMonitorLinks = [
    { incidentId: ids.incidents.api, monitorId: ids.monitors.api },
    { incidentId: ids.incidents.api, monitorId: ids.monitors.web },
    { incidentId: ids.incidents.ingest, monitorId: ids.monitors.ingest },
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

// The Alertmanager incident is internal-only; everything else is public.
const incidentStatusPageLinks = [...incidents, ...maintenanceWindows].flatMap(
    (item) => {
        const statusPageIds: string[] =
            item.id === ids.incidents.ingest
                ? [ids.statusPages.internal]
                : [
                      ids.statusPages.public,
                      ids.statusPages.europe,
                      ids.statusPages.internal,
                  ];
        if (item.id === ids.incidents.api) {
            statusPageIds.push(ids.statusPages.developers);
        }

        return statusPageIds.map((statusPageId) => ({
            incidentId: item.id,
            statusPageId,
        }));
    },
);

const statusPageReports = [
    {
        id: ids.reports.api,
        statusPageId: ids.statusPages.public,
        title: "Elevated API latency in Central Europe",
        status: "monitoring",
        severity: "major",
        createdAt: minutesAgo(75),
        resolvedAt: null,
        updatedAt: minutesAgo(9),
    },
    {
        id: ids.reports.database,
        statusPageId: ids.statusPages.public,
        title: "Database failover completed",
        status: "resolved",
        severity: "critical",
        createdAt: daysAgo(12, 4, 5),
        resolvedAt: daysAgo(12, 4, 43),
        updatedAt: daysAgo(12, 4, 43),
    },
    {
        id: ids.reports.queue,
        statusPageId: ids.statusPages.public,
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

        await tx
            .delete(user)
            .where(
                inArray(user.email, [
                    DEMO.email,
                    ...teammates.map((teammate) => teammate.email),
                ]),
            );
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
        monitorId === ids.monitors.ingest &&
        workerId === ids.workers.singapore &&
        time >= minutesAgo(22).getTime()
    ) {
        return "degraded";
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
        case ids.monitors.vpn:
            return 18;
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
) {
    await db.transaction(async (tx) => {
        await tx.insert(user).values([
            {
                id: ids.user,
                name: "Alex Carter",
                email: DEMO.email,
                emailVerified: true,
                image: null,
                role: "admin",
                banned: false,
                twoFactorEnabled: false,
                createdAt: daysAgo(61, 8),
                updatedAt: now,
            },
            // Teammates have no credential account; they exist to populate
            // the members list and incident timelines.
            ...teammates.map((teammate) => ({
                id: teammate.userId,
                name: teammate.name,
                email: teammate.email,
                emailVerified: true,
                image: null,
                role: "user",
                banned: false,
                twoFactorEnabled: false,
                createdAt: daysAgo(55, 8),
                updatedAt: now,
            })),
        ]);

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
                workerIds: workers.map((item) => item.id),
            }),
        });

        await tx.insert(member).values([
            {
                id: ids.member,
                organizationId: ids.organization,
                userId: ids.user,
                role: "owner",
                createdAt: daysAgo(61, 8),
            },
            ...teammates.map((teammate) => ({
                id: teammate.memberId,
                organizationId: ids.organization,
                userId: teammate.userId,
                role: teammate.role,
                createdAt: daysAgo(55, 8),
            })),
        ]);

        await tx.insert(invitation).values({
            id: ids.invitation,
            organizationId: ids.organization,
            email: "taylor@acme.example",
            role: "member",
            status: "pending",
            expiresAt: daysFromNow(5),
            createdAt: daysAgo(2, 10),
            inviterId: ids.user,
        });

        await tx.insert(worker).values(workers);
        await tx.insert(workerApiKey).values(
            workers.map((item) => {
                const key = generateWorkerApiKey();
                return {
                    id: randomUUID(),
                    keyHash: hashWorkerApiKey(key),
                    keyHint: `${key.slice(0, 11)}...`,
                    workerId: item.id,
                    createdAt: item.createdAt,
                    lastUsedAt: item.lastHeartbeat,
                };
            }),
        );

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

        const statusPageRows = buildStatusPageRows();
        await tx.insert(statusPage).values(statusPageRows.pages);
        await tx.insert(statusPageGroup).values(statusPageRows.groupRows);
        await tx.insert(statusPageMonitor).values(statusPageRows.monitorRows);

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
                statusPageId: ids.statusPages.public,
                email: "on-call@acme.example",
                createdAt: daysAgo(28, 8),
            },
            {
                statusPageId: ids.statusPages.public,
                email: "platform@acme.example",
                createdAt: daysAgo(20, 8),
            },
            {
                statusPageId: ids.statusPages.public,
                email: "status-updates@acme.example",
                createdAt: daysAgo(7, 8),
            },
        ]);

        await tx.insert(sslCertificateNotification).values([
            {
                id: ids.ssl.web,
                monitorId: ids.monitors.web,
                domain: "app.acme.example",
                lastNotifiedAt: daysAgo(4, 7),
                daysUntilExpiryAtNotification: "21",
                createdAt: daysAgo(30, 7),
                updatedAt: now,
            },
            {
                id: ids.ssl.api,
                monitorId: ids.monitors.api,
                domain: "api.acme.example",
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
                eq(statusPageReport.statusPageId, ids.statusPages.public),
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

    const rawOrganizationApiKey = generateOrganizationApiKey();
    await seedRelationalData(
        await hashPassword(DEMO.password),
        rawOrganizationApiKey,
    );
    console.log("Seeded workspace, monitors, incidents, and status page data.");

    await seedTimeSeries();
    await verifySeed();

    console.log("Demo login:");
    console.log(`  Email: ${DEMO.email}`);
    console.log(`  Password: ${DEMO.password}`);
    console.log(`  API key: ${rawOrganizationApiKey}`);
    console.log("Status pages:");
    for (const page of statusPages) {
        const theme = String(page.design.themeId);
        const password = page.passwordProtected
            ? `, password: ${DEMO.internalStatusPagePassword}`
            : "";
        console.log(`  /status/${page.slug} (${theme}${password})`);
    }
}

(async () => {
    try {
        await main();
    } finally {
        await timeseries.close().catch(() => undefined);
        await postgresClient.end();
    }
})();
