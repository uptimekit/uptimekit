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

export const getStatusPageEvents = async (statusPageId: string, days = 90) => {
	return unstable_cache(
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
		[`status-page-events-${statusPageId}-${days}`],
		{ revalidate: 60 },
	)();
};

import { unstable_cache } from "next/cache";

export type StatusPageData = NonNullable<
	Awaited<ReturnType<typeof getStatusPageByDomain>>
>;

export const getStatusPageByDomain = async (domain: string) => {
	return unstable_cache(
		async () => {
			// 1. Try to find by custom domain
			const page = await db.query.statusPage.findFirst({
				where: eq(statusPage.domain, domain),
			});

			if (!page) return undefined;

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
		[`status-page-${domain}`],
		{ revalidate: 60 }, // 1 minute cache
	)();
};

export const getMonitorUptime = async (monitorId: string, days = 90) => {
	return unstable_cache(
		async () => {
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - days);

			// ClickHouse query for hourly stats
			const query = `
				SELECT 
					formatDateTime(timestamp, '%Y-%m-%d %H') as date_hour,
					count(*) as total_checks,
					countIf(status = 'up') as up_checks,
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
		[`monitor-uptime-${monitorId}-${days}`],
		{ revalidate: 60 },
	)();
};

export const getActiveIncidents = async (organizationId: string) => {
	return unstable_cache(
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
		[`active-incidents-${organizationId}`],
		{ revalidate: 60 },
	)();
};

export const getActiveMaintenances = async (statusPageId: string) => {
	return unstable_cache(
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
		[`active-maintenances-${statusPageId}`],
		{ revalidate: 60 },
	)();
};

export const getActiveStatusPageReports = async (statusPageId: string) => {
	return unstable_cache(
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
		[`active-status-page-reports-${statusPageId}`],
		{ revalidate: 60 },
	)();
};

export const getStatusPageReports = async (statusPageId: string, limit = 5) => {
	return unstable_cache(
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
		[`status-page-reports-${statusPageId}`],
		{ revalidate: 60 },
	)();
};

export const getMaintenanceHistory = async (
	statusPageId: string,
	limit = 5,
) => {
	return unstable_cache(
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
		[`maintenance-history-${statusPageId}`],
		{ revalidate: 60 },
	)();
};

export const getMonitorStatus = async (monitorId: string) => {
	return unstable_cache(
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
				status: latestEvent.status,
				timestamp: new Date(latestEvent.timestamp),
			};
		},
		[`monitor-status-${monitorId}`],
		{ revalidate: 30 },
	)();
};
