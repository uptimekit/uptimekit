import {
	clickhouse,
	db,
	incident,
	maintenance,
	maintenanceMonitor,
	maintenanceStatusPage,
	maintenanceUpdate,
	statusPage,
	statusPageMonitor,
	statusPageReport,
} from "@uptimekit/db";
// ... imports
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";

// ... existing functions
import { redis } from "./redis";

// Helper to cache data in Redis
// TTL in seconds
async function cached<T>(
	key: string,
	ttl: number,
	fetcher: () => Promise<T>,
): Promise<T> {
	try {
		const cachedData = await redis.get(key);
		if (cachedData) {
			return JSON.parse(cachedData) as T;
		}
	} catch (error) {
		console.error(`Redis get error for key ${key}:`, error);
	}

	const data = await fetcher();

	try {
		if (data !== undefined) {
			await redis.set(key, JSON.stringify(data), "EX", ttl);
		}
	} catch (error) {
		console.error(`Redis set error for key ${key}:`, error);
	}

	return data;
}

export const getStatusPageEvents = async (statusPageId: string, days = 90) => {
	return cached(
		`status-page:events:${statusPageId}:${days}`,
		60, // 1 minute
		async () => {
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - days);

			const [reports, maintenances] = await Promise.all([
				db.query.statusPageReport.findMany({
					where: and(
						eq(statusPageReport.statusPageId, statusPageId),
						gte(statusPageReport.createdAt, startDate),
					),
					with: {
						affectedMonitors: {
							with: {
								monitor: true,
							},
						},
					},
				}),
				db
					.select({
						id: maintenance.id,
						title: maintenance.title,
						status: maintenance.status,
						startAt: maintenance.startAt,
						endAt: maintenance.endAt,
					})
					.from(maintenance)
					.innerJoin(
						maintenanceStatusPage,
						eq(maintenance.id, maintenanceStatusPage.maintenanceId),
					)
					.where(
						and(
							eq(maintenanceStatusPage.statusPageId, statusPageId),
							gte(maintenance.startAt, startDate),
						),
					),
			]);

			// We need monitors for maintenance
			const maintenanceWithMonitors = await Promise.all(
				maintenances.map(async (m) => {
					const monitors = await db.query.maintenanceMonitor.findMany({
						where: eq(maintenanceMonitor.maintenanceId, m.id),
						with: {
							monitor: true,
						},
					});
					return { ...m, monitors };
				}),
			);

			return { reports, maintenances: maintenanceWithMonitors };
		},
	);
};

export type StatusPageData = NonNullable<
	Awaited<ReturnType<typeof getStatusPageByDomain>>
>;

export const getStatusPageByDomain = async (domain: string) => {
	return cached(
		`status-page:${domain}`,
		600, // 10 minutes
		async () => {
			// 1. Try to find by custom domain
			const page = await db.query.statusPage.findFirst({
				where: eq(statusPage.domain, domain),
			});

			if (!page) {
				// Try by slug/subdomain logic if needed, but assuming domain param handles it or comes processed.
				// If strictly mapped by domain column:
				// Actually, earlier code just checked statusPage.domain.
				// If we want to support subdomains (slug.uptime.kit), usually that's handled before or query checks slug too.
				// The original code only checked `eq(statusPage.domain, domain)`.
				// Wait, checking original code...
				// Original: `where: eq(statusPage.domain, domain)`
				// But wait, `domain` variable in generateMetadata/StatusPage page.tsx comes from `host`.
				// If user accesses `slug.uptime.kit`, `domain` is `slug.uptime.kit`.
				// Does `statusPage` table store full domain or just custom domain?
				// Typically `slug` is used for subdomains.
				// Let's re-read the original `getStatusPageByDomain` carefully.
				// It ONLY checked `statusPage.domain`.
				// But page.tsx splits host: `const domain = host.split(":")[0];`
				// Iterate: If I am on `myslug.localhost:3000`, domain is `myslug.localhost`.
				// If DB `domain` field is null, it won't match.
				// Maybe I should match slug too?
				// Original code:
				// `where: eq(statusPage.domain, domain)`
				// If this logic was insufficient before, it is not my task to fix it, but I shouldn't break it.
				// BUT: look at `status-pages.ts` router create: `slug: input.slug`.
				// AND `update`: `domain: input.domain`.
				// If using custom domain, `domain` field is set.
				// If using default subdomain, `slug` is set.
				// The previous code ONLY checked `domain` column? That seems wrong if it doesn't check slug.
				// Ah, maybe the user hasn't implemented subdomain routing yet or `domain` is expected to match the host header exactly?
				// Let's stick to EXACT behavior of original code for the callback to minimize regression risk.
				// Original: `where: eq(statusPage.domain, domain)`
				// Wait, let's look at `apps/status-page/src/app/page.tsx`.
				// `const pageConfig = await getStatusPageByDomain(domain);`
				// If original only query by domain, then it only supports custom domains?
				// Let's check `db-queries.ts` original again.
				// Line 89: `where: eq(statusPage.domain, domain)`
				// Yes.
				// I will KEEP this logic.

				return undefined;
			}

			// 2. Fetch monitors manually to avoid complex joins that might be failing
			const monitors = await db.query.statusPageMonitor.findMany({
				where: eq(statusPageMonitor.statusPageId, page.id),
				with: {
					monitor: true,
					group: true,
				},
				orderBy: [asc(statusPageMonitor.order)],
			});

			return {
				...page,
				monitors,
			};
		},
	);
};

export const getMonitorUptime = async (monitorId: string, days = 90) => {
	return cached(
		`monitor-uptime:${monitorId}:${days}`,
		60, // 1 minute
		async () => {
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - days);

			// ClickHouse query for hourly stats
			const query = `
				SELECT 
					formatDateTime(timestamp, '%Y-%m-%d %H') as date_hour,
					count(*) as total_checks,
					countIf(lower(status) = 'up') as up_checks,
					avg(latency) as avg_latency
				FROM uptimekit.monitor_events
				WHERE monitorId = {monitorId:String}
				AND timestamp >= {startDate:DateTime64(3)}
				GROUP BY date_hour
				ORDER BY date_hour DESC
			`;

			const resultSet = await clickhouse.query({
				query,
				query_params: {
					monitorId,
					startDate: startDate.getTime(),
				},
				format: "JSON",
			});

			const result = await resultSet.json<any>();
			return result.data as {
				date_hour: string;
				total_checks: number;
				up_checks: number;
				avg_latency: number;
			}[];
		},
	);
};

export const getActiveIncidents = async (organizationId: string) => {
	return cached(
		`active-incidents:${organizationId}`,
		60, // 1 minute
		async () => {
			return await db.query.incident.findMany({
				where: and(
					eq(incident.organizationId, organizationId),
					// active statuses
					inArray(incident.status, [
						"investigating",
						"identified",
						"monitoring",
					]),
				),
				with: {
					monitors: {
						with: {
							monitor: true,
						},
					},
					activities: {
						orderBy: (activities, { desc }) => [desc(activities.createdAt)],
						limit: 1,
					},
				},
				orderBy: (incidents, { desc }) => [desc(incidents.createdAt)],
			});
		},
	);
};

export const getActiveMaintenances = async (statusPageId: string) => {
	return cached(
		`active-maintenances:${statusPageId}`,
		60, // 1 minute
		async () => {
			const activeMaintenances = await db
				.select({
					id: maintenance.id,
					title: maintenance.title,
					status: maintenance.status,
					startAt: maintenance.startAt,
					endAt: maintenance.endAt,
					createdAt: maintenance.createdAt,
					description: maintenance.description,
				})
				.from(maintenance)
				.innerJoin(
					maintenanceStatusPage,
					eq(maintenance.id, maintenanceStatusPage.maintenanceId),
				)
				.where(
					and(
						eq(maintenanceStatusPage.statusPageId, statusPageId),
						eq(maintenance.status, "in_progress"),
					),
				)
				.orderBy(desc(maintenance.startAt));

			// Fetch monitors for each maintenance
			const maintenanceWithMonitors = await Promise.all(
				activeMaintenances.map(async (m) => {
					const monitors = await db.query.maintenanceMonitor.findMany({
						where: eq(maintenanceMonitor.maintenanceId, m.id),
						with: {
							monitor: true,
						},
					});

					const updates = await db.query.maintenanceUpdate.findMany({
						where: eq(maintenanceUpdate.maintenanceId, m.id),
						orderBy: [desc(maintenanceUpdate.createdAt)],
					});

					return { ...m, monitors, updates };
				}),
			);

			return maintenanceWithMonitors;
		},
	);
};

export const getActiveStatusPageReports = async (statusPageId: string) => {
	return cached(
		`active-status-page-reports:${statusPageId}`,
		60, // 1 minute
		async () => {
			return await db.query.statusPageReport.findMany({
				where: and(
					eq(statusPageReport.statusPageId, statusPageId),
					inArray(statusPageReport.status, [
						"investigating",
						"identified",
						"monitoring",
					]),
				),
				with: {
					affectedMonitors: {
						with: {
							monitor: true,
						},
					},
					updates: {
						orderBy: (updates, { desc }) => [desc(updates.createdAt)],
						limit: 1,
					},
				},
				orderBy: (reports, { desc }) => [desc(reports.createdAt)],
			});
		},
	);
};

export const getStatusPageReports = async (statusPageId: string, limit = 5) => {
	return cached(
		`status-page-reports:${statusPageId}`,
		60, // 1 minute
		async () => {
			return await db.query.statusPageReport.findMany({
				where: and(
					eq(statusPageReport.statusPageId, statusPageId),
					eq(statusPageReport.status, "resolved"),
				),
				with: {
					affectedMonitors: {
						with: {
							monitor: true,
						},
					},
					updates: {
						orderBy: (updates, { desc }) => [desc(updates.createdAt)],
					},
				},
				orderBy: (reports, { desc }) => [desc(reports.createdAt)],
				limit: limit,
			});
		},
	);
};

export const getMaintenanceHistory = async (
	statusPageId: string,
	limit = 5,
) => {
	return cached(
		`maintenance-history:${statusPageId}`,
		60, // 1 minute
		async () => {
			// Using query builder with join manually because of many-to-many link navigation matching
			const maintenances = await db
				.select({
					id: maintenance.id,
					title: maintenance.title,
					status: maintenance.status,
					startAt: maintenance.startAt,
					endAt: maintenance.endAt,
					createdAt: maintenance.createdAt,
				})
				.from(maintenance)
				.innerJoin(
					maintenanceStatusPage,
					eq(maintenance.id, maintenanceStatusPage.maintenanceId),
				)
				.where(
					and(
						eq(maintenanceStatusPage.statusPageId, statusPageId),
						eq(maintenance.status, "completed"),
					),
				)
				.orderBy(desc(maintenance.endAt))
				.limit(limit);

			// Fetch monitors for each maintenance
			const jobs = await Promise.all(
				maintenances.map(async (m) => {
					const monitors = await db.query.maintenanceMonitor.findMany({
						where: eq(maintenanceMonitor.maintenanceId, m.id),
						with: {
							monitor: true,
						},
					});

					const updates = await db.query.maintenanceUpdate.findMany({
						where: eq(maintenanceUpdate.maintenanceId, m.id),
						orderBy: [desc(maintenanceUpdate.createdAt)],
					});

					return { ...m, monitors, updates };
				}),
			);

			return jobs;
		},
	);
};

export const getMonitorStatus = async (monitorId: string) => {
	return cached(
		`monitor-status:${monitorId}`,
		60, // 1 minute (was 30s)
		async () => {
			const query = `
				SELECT status, timestamp 
				FROM uptimekit.monitor_events 
				WHERE monitorId = {monitorId:String} 
				ORDER BY timestamp DESC 
				LIMIT 1
			`;

			const resultSet = await clickhouse.query({
				query,
				query_params: { monitorId },
				format: "JSON",
			});

			const result = await resultSet.json<any>();
			const latestEvent = result.data[0];

			if (!latestEvent) return undefined;

			// Map back to expected format if needed by caller (though 'status' is main thing)
			return {
				status: latestEvent.status.toLowerCase(),
				timestamp: new Date(latestEvent.timestamp),
			};
		},
	);
};

