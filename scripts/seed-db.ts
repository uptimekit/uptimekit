// very crappy and slop

import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import {
	account,
	apikey,
	db,
	incident,
	incidentActivity,
	incidentMonitor,
	incidentStatusPage,
	integrationConfig,
	type MonitorChangeInsert,
	type MonitorEventInsert,
	maintenance,
	maintenanceMonitor,
	maintenanceStatusPage,
	maintenanceUpdate,
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
import { eq, inArray } from "drizzle-orm";

const SEED = {
	userId: "seed-user-demo-admin",
	accountId: "seed-account-demo-admin",
	orgId: "seed-org-acme-cloud",
	email: "demo@uptimekit.local",
	password: "DemoPassword123!",
	statusPageId: "seed-status-page-acme-cloud",
	statusPageSlug: "acme-cloud-status-demo",
};
const TIMESERIES_INSERT_CHUNK_SIZE = 1_000;

const workerIds = ["demo-us-east", "demo-eu-west", "demo-ap-south"] as const;

const ids = {
	workers: {
		usEast: "demo-us-east",
		euWest: "demo-eu-west",
		apSouth: "demo-ap-south",
	},
	workerApiKeys: {
		usEast: "seed-worker-key-us-east",
		euWest: "seed-worker-key-eu-west",
		apSouth: "seed-worker-key-ap-south",
	},
	groups: {
		api: "seed-group-api-platform",
		customer: "seed-group-customer-experience",
		infrastructure: "seed-group-infrastructure",
		data: "seed-group-data-platform",
	},
	tags: {
		critical: "seed-tag-critical",
		production: "seed-tag-production",
		public: "seed-tag-public",
		internal: "seed-tag-internal",
	},
	integrations: {
		webhook: "seed-integration-webhook",
		apprise: "seed-integration-apprise",
	},
	statusGroups: {
		core: "seed-status-group-core-services",
		infrastructure: "seed-status-group-infrastructure",
	},
	monitors: {
		api: "seed-monitor-api-gateway",
		web: "seed-monitor-web-app",
		auth: "seed-monitor-auth-service",
		db: "seed-monitor-primary-db",
		queue: "seed-monitor-worker-queue",
		dns: "seed-monitor-dns-edge",
		search: "seed-monitor-search-api",
	},
	incidents: {
		api: "seed-incident-api-eu-edge",
		search: "seed-incident-search-indexing",
		db: "seed-incident-db-failover",
	},
	maintenance: {
		active: "seed-maintenance-queue-drain",
		scheduled: "seed-maintenance-db-indexes",
		completed: "seed-maintenance-edge-cache",
	},
	reports: {
		legacy: "seed-status-report-api-eu-edge",
	},
	ssl: "seed-ssl-notification-web-app",
	apiKey: "seed-api-key-demo",
} as const;

const now = new Date();
const scrypt = promisify(scryptCallback);

async function hashPassword(password: string) {
	const salt = randomBytes(16).toString("hex");
	const key = (await scrypt(password.normalize("NFKC"), salt, 64, {
		N: 16_384,
		r: 16,
		p: 1,
		maxmem: 128 * 16_384 * 16 * 2,
	})) as Buffer;

	return `${salt}:${key.toString("hex")}`;
}

function minutesAgo(minutes: number) {
	return new Date(now.getTime() - minutes * 60_000);
}

function daysAgo(days: number, hour = 12) {
	const date = new Date(now);
	date.setUTCDate(date.getUTCDate() - days);
	date.setUTCHours(hour, 0, 0, 0);
	return date;
}

function daysFromNow(days: number, hour = 12) {
	const date = new Date(now);
	date.setUTCDate(date.getUTCDate() + days);
	date.setUTCHours(hour, 0, 0, 0);
	return date;
}

function hoursAfter(date: Date, hours: number) {
	return new Date(date.getTime() + hours * 60 * 60_000);
}

function createHttpConfig(url: string, extra: Record<string, unknown> = {}) {
	return {
		type: "http",
		url,
		method: "GET",
		headers: {
			"X-UptimeKit-Demo": "true",
		},
		checkSsl: true,
		sslCertExpiryNotificationDays: 21,
		acceptedStatusCodes: "200-299",
		...extra,
	};
}

const workers = [
	{
		id: ids.workers.usEast,
		name: "US East Worker",
		location: ids.workers.usEast,
		active: true,
		lastHeartbeat: minutesAgo(2),
		version: "4.0.0-demo",
	},
	{
		id: ids.workers.euWest,
		name: "EU West Worker",
		location: ids.workers.euWest,
		active: true,
		lastHeartbeat: minutesAgo(3),
		version: "4.0.0-demo",
	},
	{
		id: ids.workers.apSouth,
		name: "AP South Worker",
		location: ids.workers.apSouth,
		active: true,
		lastHeartbeat: minutesAgo(5),
		version: "4.0.0-demo",
	},
] satisfies Array<typeof worker.$inferInsert>;

const groups = [
	{
		id: ids.groups.api,
		organizationId: SEED.orgId,
		parentId: null,
		name: "API Platform",
	},
	{
		id: ids.groups.customer,
		organizationId: SEED.orgId,
		parentId: null,
		name: "Customer Experience",
	},
	{
		id: ids.groups.infrastructure,
		organizationId: SEED.orgId,
		parentId: null,
		name: "Infrastructure",
	},
	{
		id: ids.groups.data,
		organizationId: SEED.orgId,
		parentId: ids.groups.infrastructure,
		name: "Data Platform",
	},
] satisfies Array<typeof monitorGroup.$inferInsert>;

const tags = [
	{
		id: ids.tags.critical,
		organizationId: SEED.orgId,
		name: "Critical",
		color: "#dc2626",
	},
	{
		id: ids.tags.production,
		organizationId: SEED.orgId,
		name: "Production",
		color: "#16a34a",
	},
	{
		id: ids.tags.public,
		organizationId: SEED.orgId,
		name: "Public",
		color: "#2563eb",
	},
	{
		id: ids.tags.internal,
		organizationId: SEED.orgId,
		name: "Internal",
		color: "#9333ea",
	},
] satisfies Array<typeof tag.$inferInsert>;

const integrations = [
	{
		id: ids.integrations.webhook,
		organizationId: SEED.orgId,
		name: "Ops Webhook",
		type: "webhook",
		config: {
			url: "https://example.com/uptimekit/demo-webhook",
			secret: "demo-secret",
		},
		active: true,
		isDefault: true,
	},
	{
		id: ids.integrations.apprise,
		organizationId: SEED.orgId,
		name: "Apprise Fanout",
		type: "apprise",
		config: {
			notifyUrl: "mailto://alerts@example.com",
		},
		active: false,
		isDefault: false,
	},
] satisfies Array<typeof integrationConfig.$inferInsert>;

const monitors = [
	{
		id: ids.monitors.api,
		organizationId: SEED.orgId,
		groupId: ids.groups.api,
		name: "API Gateway",
		type: "http",
		active: true,
		interval: 60,
		timeout: 20,
		retries: 2,
		retryInterval: 15,
		incidentPendingDuration: 60,
		incidentRecoveryDuration: 120,
		publishIncidentToStatusPage: true,
		locations: [...workerIds],
		workerIds: [...workerIds],
		config: createHttpConfig("https://api.acme-cloud.example/health"),
		successStatuses: [200, 201, 204],
	},
	{
		id: ids.monitors.web,
		organizationId: SEED.orgId,
		groupId: ids.groups.customer,
		name: "Customer Web App",
		type: "http",
		active: true,
		interval: 60,
		timeout: 25,
		retries: 2,
		retryInterval: 20,
		incidentPendingDuration: 120,
		incidentRecoveryDuration: 120,
		publishIncidentToStatusPage: true,
		locations: [...workerIds],
		workerIds: [...workerIds],
		config: createHttpConfig("https://app.acme-cloud.example/"),
		successStatuses: [200],
	},
	{
		id: ids.monitors.auth,
		organizationId: SEED.orgId,
		groupId: ids.groups.api,
		name: "Auth Service",
		type: "http-json",
		active: true,
		interval: 90,
		timeout: 20,
		retries: 2,
		retryInterval: 15,
		incidentPendingDuration: 60,
		incidentRecoveryDuration: 180,
		publishIncidentToStatusPage: true,
		locations: [ids.workers.usEast, ids.workers.euWest],
		workerIds: [ids.workers.usEast, ids.workers.euWest],
		config: createHttpConfig("https://auth.acme-cloud.example/status", {
			type: "http-json",
			jsonPath: "$.status",
			expectedValue: "ok",
		}),
		successStatuses: [200],
	},
	{
		id: ids.monitors.db,
		organizationId: SEED.orgId,
		groupId: ids.groups.data,
		name: "Primary Database",
		type: "tcp",
		active: true,
		interval: 120,
		timeout: 15,
		retries: 3,
		retryInterval: 20,
		incidentPendingDuration: 120,
		incidentRecoveryDuration: 300,
		publishIncidentToStatusPage: true,
		locations: [ids.workers.usEast, ids.workers.euWest],
		workerIds: [ids.workers.usEast, ids.workers.euWest],
		config: {
			type: "tcp",
			hostname: "db.acme-cloud.example",
			port: 5432,
		},
		successStatuses: null,
	},
	{
		id: ids.monitors.queue,
		organizationId: SEED.orgId,
		groupId: ids.groups.infrastructure,
		name: "Worker Queue",
		type: "keyword",
		active: true,
		interval: 120,
		timeout: 20,
		retries: 2,
		retryInterval: 20,
		incidentPendingDuration: 120,
		incidentRecoveryDuration: 120,
		publishIncidentToStatusPage: true,
		locations: [ids.workers.usEast, ids.workers.apSouth],
		workerIds: [ids.workers.usEast, ids.workers.apSouth],
		config: createHttpConfig("https://queue.acme-cloud.example/health", {
			type: "keyword",
			keyword: "healthy",
		}),
		successStatuses: [200],
	},
	{
		id: ids.monitors.dns,
		organizationId: SEED.orgId,
		groupId: ids.groups.infrastructure,
		name: "DNS Edge",
		type: "dns",
		active: true,
		interval: 180,
		timeout: 15,
		retries: 2,
		retryInterval: 30,
		incidentPendingDuration: 60,
		incidentRecoveryDuration: 120,
		publishIncidentToStatusPage: true,
		locations: [...workerIds],
		workerIds: [...workerIds],
		config: {
			type: "dns",
			hostname: "acme-cloud.example",
			resolverServers: "1.1.1.1",
			port: 53,
			recordType: "A",
			expectedValue: "203.0.113.42",
		},
		successStatuses: null,
	},
	{
		id: ids.monitors.search,
		organizationId: SEED.orgId,
		groupId: ids.groups.api,
		name: "Search API",
		type: "http",
		active: false,
		pauseReason: "Paused for a demo migration",
		interval: 120,
		timeout: 20,
		retries: 2,
		retryInterval: 20,
		incidentPendingDuration: 120,
		incidentRecoveryDuration: 120,
		publishIncidentToStatusPage: false,
		locations: [ids.workers.usEast],
		workerIds: [ids.workers.usEast],
		config: createHttpConfig("https://search.acme-cloud.example/health"),
		successStatuses: [200],
	},
] satisfies Array<typeof monitor.$inferInsert>;

const monitorTags = [
	[ids.monitors.api, ids.tags.critical],
	[ids.monitors.api, ids.tags.production],
	[ids.monitors.api, ids.tags.public],
	[ids.monitors.web, ids.tags.production],
	[ids.monitors.web, ids.tags.public],
	[ids.monitors.auth, ids.tags.critical],
	[ids.monitors.auth, ids.tags.internal],
	[ids.monitors.db, ids.tags.critical],
	[ids.monitors.db, ids.tags.internal],
	[ids.monitors.queue, ids.tags.internal],
	[ids.monitors.dns, ids.tags.public],
	[ids.monitors.search, ids.tags.internal],
].map(([monitorId, tagId]) => ({ monitorId, tagId }));

const monitorNotifications = monitors
	.filter((item) => item.active)
	.map((item) => ({
		monitorId: item.id,
		integrationConfigId: ids.integrations.webhook,
	}));

const activeMaintenanceStart = minutesAgo(30);
const activeMaintenanceEnd = hoursAfter(activeMaintenanceStart, 2);
const scheduledMaintenanceStart = daysFromNow(2, 2);
const scheduledMaintenanceEnd = hoursAfter(scheduledMaintenanceStart, 3);
const completedMaintenanceStart = daysAgo(14, 1);
const completedMaintenanceEnd = hoursAfter(completedMaintenanceStart, 2);

const incidents = [
	{
		id: ids.incidents.api,
		organizationId: SEED.orgId,
		title: "Elevated API error rate in EU edge",
		description:
			"Requests routed through the EU edge are intermittently receiving 503 responses. Traffic has been shifted while we monitor recovery.",
		status: "monitoring",
		severity: "major",
		type: "automatic",
		acknowledgedAt: minutesAgo(74),
		acknowledgedBy: SEED.userId,
		startedAt: minutesAgo(90),
		endedAt: null,
		resolvedAt: null,
		externalId: "mock-api-eu-edge",
		externalSource: "seed",
	},
	{
		id: ids.incidents.search,
		organizationId: SEED.orgId,
		title: "Search indexing delay",
		description:
			"Product search results lagged behind writes while a queue consumer caught up.",
		status: "resolved",
		severity: "minor",
		type: "manual",
		acknowledgedAt: daysAgo(8, 10),
		acknowledgedBy: SEED.userId,
		startedAt: daysAgo(8, 9),
		endedAt: daysAgo(8, 11),
		resolvedAt: daysAgo(8, 11),
		externalId: "mock-search-indexing",
		externalSource: "seed",
	},
	{
		id: ids.incidents.db,
		organizationId: SEED.orgId,
		title: "Primary database failover",
		description:
			"The primary writer failed over to the standby cluster after storage latency exceeded the configured threshold.",
		status: "resolved",
		severity: "critical",
		type: "automatic",
		acknowledgedAt: daysAgo(27, 3),
		acknowledgedBy: SEED.userId,
		startedAt: daysAgo(27, 2),
		endedAt: daysAgo(27, 4),
		resolvedAt: daysAgo(27, 4),
		externalId: "mock-db-failover",
		externalSource: "seed",
	},
] satisfies Array<typeof incident.$inferInsert>;

const incidentActivities = [
	{
		id: "seed-incident-activity-api-1",
		incidentId: ids.incidents.api,
		message: "EU edge checks began failing from one region.",
		type: "event",
		createdAt: minutesAgo(90),
		userId: null,
	},
	{
		id: "seed-incident-activity-api-2",
		incidentId: ids.incidents.api,
		message: "Traffic has been shifted away from the affected edge pool.",
		type: "comment",
		createdAt: minutesAgo(64),
		userId: SEED.userId,
	},
	{
		id: "seed-incident-activity-api-3",
		incidentId: ids.incidents.api,
		message: "Error rate is back within normal range. Monitoring continues.",
		type: "comment",
		createdAt: minutesAgo(18),
		userId: SEED.userId,
	},
	{
		id: "seed-incident-activity-search-1",
		incidentId: ids.incidents.search,
		message: "Indexing workers were scaled up and the backlog cleared.",
		type: "comment",
		createdAt: daysAgo(8, 11),
		userId: SEED.userId,
	},
	{
		id: "seed-incident-activity-db-1",
		incidentId: ids.incidents.db,
		message: "Failover completed and write traffic was restored.",
		type: "comment",
		createdAt: daysAgo(27, 4),
		userId: SEED.userId,
	},
] satisfies Array<typeof incidentActivity.$inferInsert>;

const incidentMonitorLinks = [
	{ incidentId: ids.incidents.api, monitorId: ids.monitors.api },
	{ incidentId: ids.incidents.api, monitorId: ids.monitors.web },
	{ incidentId: ids.incidents.search, monitorId: ids.monitors.search },
	{ incidentId: ids.incidents.db, monitorId: ids.monitors.db },
] satisfies Array<typeof incidentMonitor.$inferInsert>;

const incidentStatusPageLinks = incidents.map((item) => ({
	incidentId: item.id,
	statusPageId: SEED.statusPageId,
}));

const maintenances = [
	{
		id: ids.maintenance.active,
		organizationId: SEED.orgId,
		title: "Worker queue drain",
		description:
			"Queue consumers are being restarted in batches while jobs continue to process at reduced concurrency.",
		startAt: activeMaintenanceStart,
		endAt: activeMaintenanceEnd,
		status: "in_progress",
	},
	{
		id: ids.maintenance.scheduled,
		organizationId: SEED.orgId,
		title: "Database index rebuild",
		description:
			"Read replicas will rebuild high-cardinality indexes. Brief query latency increases are expected.",
		startAt: scheduledMaintenanceStart,
		endAt: scheduledMaintenanceEnd,
		status: "scheduled",
	},
	{
		id: ids.maintenance.completed,
		organizationId: SEED.orgId,
		title: "Edge cache software update",
		description:
			"Edge cache nodes were upgraded region by region with no customer impact.",
		startAt: completedMaintenanceStart,
		endAt: completedMaintenanceEnd,
		status: "completed",
	},
] satisfies Array<typeof maintenance.$inferInsert>;

const maintenanceMonitorLinks = [
	{ maintenanceId: ids.maintenance.active, monitorId: ids.monitors.queue },
	{ maintenanceId: ids.maintenance.scheduled, monitorId: ids.monitors.db },
	{ maintenanceId: ids.maintenance.scheduled, monitorId: ids.monitors.api },
	{ maintenanceId: ids.maintenance.completed, monitorId: ids.monitors.web },
	{ maintenanceId: ids.maintenance.completed, monitorId: ids.monitors.dns },
] satisfies Array<typeof maintenanceMonitor.$inferInsert>;

const maintenanceStatusPageLinks = maintenances.map((item) => ({
	maintenanceId: item.id,
	statusPageId: SEED.statusPageId,
}));

const maintenanceUpdates = [
	{
		id: "seed-maintenance-update-active-1",
		maintenanceId: ids.maintenance.active,
		message: "Queue drain is underway. Job throughput is reduced but stable.",
		status: "in_progress",
		createdAt: activeMaintenanceStart,
		updatedAt: activeMaintenanceStart,
	},
	{
		id: "seed-maintenance-update-scheduled-1",
		maintenanceId: ids.maintenance.scheduled,
		message: "Maintenance scheduled for the low-traffic window.",
		status: "scheduled",
		createdAt: daysAgo(1, 8),
		updatedAt: daysAgo(1, 8),
	},
	{
		id: "seed-maintenance-update-completed-1",
		maintenanceId: ids.maintenance.completed,
		message: "Upgrade completed successfully across all edge regions.",
		status: "completed",
		createdAt: completedMaintenanceEnd,
		updatedAt: completedMaintenanceEnd,
	},
] satisfies Array<typeof maintenanceUpdate.$inferInsert>;

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
			monitorId: ids.monitors.db,
			groupId: ids.statusGroups.infrastructure,
			style: "history",
			description: "Primary write database endpoint.",
		},
		{
			monitorId: ids.monitors.queue,
			groupId: ids.statusGroups.infrastructure,
			style: "status",
			description: "Background job queue health.",
		},
		{
			monitorId: ids.monitors.dns,
			groupId: ids.statusGroups.infrastructure,
			style: "history",
			description: "Authoritative DNS resolution.",
		},
	];

	return links.map((link, order) => ({
		statusPageId: SEED.statusPageId,
		monitorId: link.monitorId,
		groupId: link.groupId,
		style: link.style,
		description: link.description,
		order,
	}));
}

async function ensureDemoUser(passwordHash: string) {
	const [existingUser] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.email, SEED.email))
		.limit(1);
	const demoUserId = existingUser?.id ?? SEED.userId;

	if (existingUser) {
		await db
			.update(user)
			.set({
				name: "Demo Admin",
				emailVerified: true,
				role: "admin",
				banned: false,
				banReason: null,
				banExpires: null,
				twoFactorEnabled: false,
				updatedAt: now,
			})
			.where(eq(user.id, demoUserId));
	} else {
		await db
			.insert(user)
			.values({
				id: demoUserId,
				name: "Demo Admin",
				email: SEED.email,
				emailVerified: true,
				image: null,
				role: "admin",
				banned: false,
				twoFactorEnabled: false,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: user.id,
				set: {
					name: "Demo Admin",
					email: SEED.email,
					emailVerified: true,
					role: "admin",
					banned: false,
					twoFactorEnabled: false,
					updatedAt: now,
				},
			});
	}

	await db.delete(account).where(eq(account.id, SEED.accountId));
	await db
		.insert(account)
		.values({
			id: SEED.accountId,
			accountId: demoUserId,
			providerId: "credential",
			userId: demoUserId,
			password: passwordHash,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: account.id,
			set: {
				accountId: demoUserId,
				providerId: "credential",
				userId: demoUserId,
				password: passwordHash,
				updatedAt: now,
			},
		});

	return demoUserId;
}

async function seedRelationalData(demoUserId: string) {
	await db.transaction(async (tx) => {
		await tx.delete(organization).where(eq(organization.id, SEED.orgId));
		await tx.delete(worker).where(inArray(worker.id, [...workerIds]));

		await tx.insert(organization).values({
			id: SEED.orgId,
			name: "Acme Cloud",
			slug: "acme-cloud-demo",
			logo: null,
			activeMonitorLimit: 25,
			regionsPerMonitorLimit: 5,
			createdAt: now,
			metadata: JSON.stringify({ source: "mock-seed" }),
		});

		await tx.insert(member).values({
			id: "seed-member-demo-admin",
			organizationId: SEED.orgId,
			userId: demoUserId,
			role: "owner",
			createdAt: now,
		});

		await tx.insert(worker).values(workers);
		await tx.insert(workerApiKey).values([
			{
				id: ids.workerApiKeys.usEast,
				keyHash: "seed-worker-key-hash-us-east",
				keyHint: "uk_us_ea",
				workerId: ids.workers.usEast,
				createdAt: now,
				lastUsedAt: minutesAgo(3),
			},
			{
				id: ids.workerApiKeys.euWest,
				keyHash: "seed-worker-key-hash-eu-west",
				keyHint: "uk_eu_we",
				workerId: ids.workers.euWest,
				createdAt: now,
				lastUsedAt: minutesAgo(4),
			},
			{
				id: ids.workerApiKeys.apSouth,
				keyHash: "seed-worker-key-hash-ap-south",
				keyHint: "uk_ap_so",
				workerId: ids.workers.apSouth,
				createdAt: now,
				lastUsedAt: minutesAgo(6),
			},
		]);

		await tx.insert(apikey).values({
			id: ids.apiKey,
			configId: "default",
			name: "Demo API Key",
			start: "uk_api_demo",
			prefix: "uk_api_",
			key: "uk_api_demo_mock_key_not_for_production",
			referenceId: SEED.orgId,
			enabled: true,
			rateLimitEnabled: true,
			rateLimitTimeWindow: 60_000,
			rateLimitMax: 120,
			requestCount: 12,
			remaining: 108,
			lastRequest: minutesAgo(42),
			createdAt: now,
			updatedAt: now,
			permissions: JSON.stringify({
				monitor: ["read", "write"],
				statusPage: ["read"],
			}),
			metadata: JSON.stringify({ source: "mock-seed" }),
		});

		await tx.insert(monitorGroup).values(groups);
		await tx.insert(tag).values(tags);
		await tx.insert(integrationConfig).values(integrations);
		await tx.insert(monitor).values(monitors);
		await tx.insert(monitorTag).values(monitorTags);
		await tx.insert(monitorNotification).values(monitorNotifications);

		await tx.insert(statusPage).values({
			id: SEED.statusPageId,
			organizationId: SEED.orgId,
			name: "Acme Cloud Status",
			slug: SEED.statusPageSlug,
			domain: null,
			description: "Live uptime and incident history for Acme Cloud services.",
			public: true,
			password: null,
			design: {
				themeId: "signal",
				theme: "light",
				headerLayout: "horizontal",
				barStyle: "signal",
				barDays: 90,
				percentDigits: 2,
				allowSubscriptions: true,
				websiteUrl: "https://acme-cloud.example",
				contactUrl: "mailto:support@acme-cloud.example",
			},
		});
		await tx.insert(statusPageGroup).values([
			{
				id: ids.statusGroups.core,
				statusPageId: SEED.statusPageId,
				name: "Core Services",
				order: 0,
			},
			{
				id: ids.statusGroups.infrastructure,
				statusPageId: SEED.statusPageId,
				name: "Infrastructure",
				order: 1,
			},
		]);
		await tx.insert(statusPageMonitor).values(buildStatusPageMonitorLinks());

		await tx
			.insert(incident)
			.values(
				incidents.map((item) =>
					item.acknowledgedBy === SEED.userId
						? { ...item, acknowledgedBy: demoUserId }
						: item,
				),
			);
		await tx.insert(incidentMonitor).values(incidentMonitorLinks);
		await tx.insert(incidentStatusPage).values(incidentStatusPageLinks);
		await tx
			.insert(incidentActivity)
			.values(
				incidentActivities.map((item) =>
					item.userId === SEED.userId ? { ...item, userId: demoUserId } : item,
				),
			);

		await tx.insert(maintenance).values(maintenances);
		await tx.insert(maintenanceMonitor).values(maintenanceMonitorLinks);
		await tx.insert(maintenanceStatusPage).values(maintenanceStatusPageLinks);
		await tx.insert(maintenanceUpdate).values(maintenanceUpdates);

		await tx.insert(statusPageReport).values({
			id: ids.reports.legacy,
			statusPageId: SEED.statusPageId,
			title: "Elevated API error rate in EU edge",
			status: "monitoring",
			severity: "major",
			createdAt: minutesAgo(90),
			resolvedAt: null,
			updatedAt: minutesAgo(18),
		});
		await tx.insert(statusPageReportUpdate).values([
			{
				id: "seed-status-report-update-api-1",
				reportId: ids.reports.legacy,
				message: "EU edge traffic shifted while recovery is monitored.",
				status: "monitoring",
				createdAt: minutesAgo(18),
				userId: demoUserId,
			},
		]);
		await tx.insert(statusPageReportMonitor).values([
			{
				reportId: ids.reports.legacy,
				monitorId: ids.monitors.api,
				status: "degraded",
			},
			{
				reportId: ids.reports.legacy,
				monitorId: ids.monitors.web,
				status: "degraded",
			},
		]);

		await tx.insert(statusPageEmailSubscribers).values([
			{
				statusPageId: SEED.statusPageId,
				email: "ops@example.com",
				createdAt: daysAgo(22, 8),
			},
			{
				statusPageId: SEED.statusPageId,
				email: "support@example.com",
				slackWebhookUrl: "https://hooks.slack.com/services/demo/demo/demo",
				createdAt: daysAgo(18, 8),
			},
			{
				statusPageId: SEED.statusPageId,
				email: "cto@example.com",
				discordWebhookUrl: "https://discord.com/api/webhooks/demo/demo",
				createdAt: daysAgo(3, 8),
			},
		]);

		await tx.insert(sslCertificateNotification).values({
			id: ids.ssl,
			monitorId: ids.monitors.web,
			domain: "app.acme-cloud.example",
			lastNotifiedAt: daysAgo(2, 7),
			daysUntilExpiryAtNotification: "14",
		});
	});
}

function statusForEvent(input: {
	monitorId: string;
	location: string;
	timestamp: Date;
}) {
	const { monitorId, location, timestamp } = input;
	const time = timestamp.getTime();

	if (
		monitorId === ids.monitors.api &&
		location === ids.workers.euWest &&
		time >= minutesAgo(90).getTime()
	) {
		return "down";
	}

	if (
		monitorId === ids.monitors.queue &&
		time >= activeMaintenanceStart.getTime()
	) {
		return "maintenance";
	}

	if (
		monitorId === ids.monitors.db &&
		time >= daysAgo(27, 2).getTime() &&
		time <= daysAgo(27, 4).getTime()
	) {
		return "down";
	}

	if (
		monitorId === ids.monitors.search &&
		time >= daysAgo(8, 9).getTime() &&
		time <= daysAgo(8, 11).getTime()
	) {
		return "degraded";
	}

	return "up";
}

function latencyForEvent(status: string, baseLatency: number, offset: number) {
	if (status === "down") {
		return 0;
	}

	if (status === "maintenance") {
		return Math.round(baseLatency * 0.8 + offset);
	}

	if (status === "degraded") {
		return Math.round(baseLatency * 4 + offset * 2);
	}

	return Math.round(baseLatency + offset);
}

function buildTimeSeriesSeed() {
	const events: MonitorEventInsert[] = [];
	const changes: MonitorChangeInsert[] = [];
	const previousStatus = new Map<string, string>();
	const activeMonitors = monitors.filter(
		(item) => item.active || item.id === ids.monitors.search,
	);
	const start = daysAgo(30, now.getUTCHours());
	const pointCount = 30 * 24 + 1;

	for (const monitorRecord of activeMonitors) {
		const locations = monitorRecord.workerIds as string[];
		const baseLatency =
			monitorRecord.id === ids.monitors.db
				? 34
				: monitorRecord.id === ids.monitors.dns
					? 22
					: monitorRecord.id === ids.monitors.web
						? 180
						: 95;

		for (let index = 0; index < pointCount; index++) {
			const timestamp = new Date(start.getTime() + index * 60 * 60_000);
			if (timestamp.getTime() > now.getTime()) {
				continue;
			}

			for (const location of locations) {
				const status = statusForEvent({
					monitorId: monitorRecord.id,
					location,
					timestamp,
				});
				const offset =
					(index % 9) * 4 +
					(location === ids.workers.euWest
						? 18
						: location === ids.workers.apSouth
							? 42
							: 0);
				const latency = latencyForEvent(status, baseLatency, offset);
				const eventKey = `${monitorRecord.id}:${location}`;

				events.push({
					id: randomUUID(),
					monitorId: monitorRecord.id,
					status,
					latency,
					timestamp,
					statusCode:
						monitorRecord.type === "http" ||
						monitorRecord.type === "http-json" ||
						monitorRecord.type === "keyword"
							? status === "down"
								? 503
								: 200
							: null,
					error: status === "down" ? "Synthetic upstream timeout" : null,
					location,
					dnsLookup:
						status === "down" ? null : Math.max(4, Math.round(latency * 0.08)),
					tcpConnect:
						status === "down" ? null : Math.max(6, Math.round(latency * 0.12)),
					tlsHandshake:
						status === "down" ? null : Math.max(8, Math.round(latency * 0.18)),
					ttfb:
						status === "down" ? null : Math.max(12, Math.round(latency * 0.45)),
					transfer:
						status === "down" ? null : Math.max(4, Math.round(latency * 0.17)),
				});

				if (previousStatus.get(eventKey) !== status) {
					changes.push({
						id: randomUUID(),
						monitorId: monitorRecord.id,
						status,
						timestamp,
						location,
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
		await insertChunk(items.slice(index, index + TIMESERIES_INSERT_CHUNK_SIZE));
	}
}

async function seedTimeSeries() {
	try {
		await timeseries.ping();

		for (const monitorId of Object.values(ids.monitors)) {
			await timeseries.deleteAllForMonitor(monitorId);
		}

		const { events, changes } = buildTimeSeriesSeed();
		await insertTimeSeriesInChunks(events, (chunk) =>
			timeseries.insertMonitorEvents(chunk),
		);
		await insertTimeSeriesInChunks(changes, (chunk) =>
			timeseries.insertMonitorChanges(chunk),
		);

		console.log(
			`Seeded ${events.length} monitor events and ${changes.length} monitor changes in ${timeseries.backend}.`,
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(
			`Skipped time-series mock checks because ${timeseries.backend} is not reachable: ${message}`,
		);
	} finally {
		await timeseries.close().catch(() => undefined);
	}
}

async function verifySeed() {
	const [monitorCount, incidentCount, maintenanceCount, subscriberCount] =
		await Promise.all([
			db.$count(monitor, eq(monitor.organizationId, SEED.orgId)),
			db.$count(incident, eq(incident.organizationId, SEED.orgId)),
			db.$count(maintenance, eq(maintenance.organizationId, SEED.orgId)),
			db.$count(
				statusPageEmailSubscribers,
				eq(statusPageEmailSubscribers.statusPageId, SEED.statusPageId),
			),
		]);

	console.log(
		`Verified mock data: ${monitorCount} monitors, ${incidentCount} incidents, ${maintenanceCount} maintenance windows, ${subscriberCount} subscribers.`,
	);
}

async function main() {
	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL is not defined.");
	}

	console.log("Seeding UptimeKit mock data...");

	const passwordHash = await hashPassword(SEED.password);
	const demoUserId = await ensureDemoUser(passwordHash);

	await seedRelationalData(demoUserId);
	console.log("Seeded relational mock data.");

	await seedTimeSeries();
	await verifySeed();

	console.log("Demo login:");
	console.log(`  Email: ${SEED.email}`);
	console.log(`  Password: ${SEED.password}`);
	console.log(`  Status page slug: ${SEED.statusPageSlug}`);
}

try {
	await main();
} finally {
	await postgresClient.end();
}
