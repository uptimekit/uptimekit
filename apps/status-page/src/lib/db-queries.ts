import {
	db,
	incident,
	maintenance,
	maintenanceMonitor,
	maintenanceStatusPage,
	maintenanceUpdate,
	monitorEvent,
	statusPage,
	statusPageMonitor,
	statusPageReport,
} from "@uptimekit/db";
// ... imports
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";

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

			// We want to group by day and calculate success rate
			// This is a simplified calculation. Ideally "uptime" is (total_checks - down_checks) / total_checks
			// Grouping by date_trunc('day', timestamp)

			const result = await db.execute(sql`
                SELECT 
                    to_char(timestamp, 'YYYY-MM-DD') as date,
                    count(*) as total_checks,
                    count(case when status = 'up' then 1 end) as up_checks,
                    avg(latency) as avg_latency
                FROM ${monitorEvent}
                WHERE ${eq(monitorEvent.monitorId, monitorId)}
                AND timestamp >= ${startDate}
                GROUP BY 1
                ORDER BY 1 DESC
            `);

			// Handle different DB driver return types (e.g. valid array vs object with .rows)
			// Some drivers return { rows: [...] }, others return Array-like objects
			const rows = Array.isArray(result) ? result : (result as any).rows || [];

			// Fill in missing days?
			// For now, mapping the result
			return rows as unknown as {
				date: string;
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
			return await db.query.monitorEvent.findFirst({
				where: eq(monitorEvent.monitorId, monitorId),
				orderBy: [desc(monitorEvent.timestamp)],
			});
		},
		[`monitor-status-${monitorId}`],
		{ revalidate: 30 },
	)();
};
