import { clickhouse, db } from "@uptimekit/db";
import {
	incident,
	incidentActivity,
	incidentMonitor,
	incidentStatusPage,
} from "@uptimekit/db/schema/incidents";
import {
	maintenance,
	maintenanceMonitor,
} from "@uptimekit/db/schema/maintenance";
import { monitor } from "@uptimekit/db/schema/monitors";
import { statusPageMonitor } from "@uptimekit/db/schema/status-pages";
import { worker } from "@uptimekit/db/schema/workers";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { eventBus } from "../../lib/events";
import type { LatestEventResult } from "../../types/clickhouse";

// Types
export interface HTTPTimings {
	dnsLookup?: number;
	tcpConnect?: number;
	tlsHandshake?: number;
	ttfb?: number;
	transfer?: number;
	total?: number;
}

export interface MonitorEvent {
	monitorId: string;
	status: "up" | "down" | "degraded" | "maintenance" | "pending";
	latency: number;
	timestamp: string | Date | number;
	statusCode?: number;
	error?: string;
	location?: string;
	timings?: HTTPTimings;
}

interface MonitorChangeInsert {
	id: string;
	monitorId: string;
	status: string;
	timestamp: Date;
	location?: string | null;
}

interface RegionStatusSnapshot {
	status: MonitorEvent["status"];
	timestamp: Date;
}

/**
 * Retrieve active monitors assigned to the given worker location and return their runtime configuration.
 *
 * @param workerLocation - The worker location identifier used to filter monitors whose `locations` include this value
 * @returns An array of monitor configuration objects containing: `id`, `type`, `url` (defaults to `""`), `hostname` (defaults to `""`), `port` (defaults to `0`), `interval`, `timeout`, `method` (defaults to `"GET"`), `headers` (defaults to `{}`), `body`, `acceptedStatusCodes`, `keyword`, `jsonPath`, `expectedValue`, `checkSsl` (defaults to `true`), and `sslCertExpiryNotificationDays` (defaults to `30`)
 */
export async function getMonitorsForWorker(workerId: string) {
	const workerRecord = await db.query.worker.findFirst({
		where: eq(worker.id, workerId),
	});

	if (!workerRecord) {
		return [];
	}

	const allActiveMonitors = await db.query.monitor.findMany({
		where: (t, { eq }) => eq(t.active, true),
	});

	return allActiveMonitors
		.filter((m) => {
			const workerIds = (m.workerIds as string[] | null) ?? [];
			if (workerIds.length > 0) {
				return workerIds.includes(workerId);
			}
			const locations = (m.locations as string[] | null) ?? [];
			return locations.includes(workerRecord.location);
		})
		.map((m) => {
			const config = m.config as {
				url?: string;
				hostname?: string;
				port?: number;
				method?: string;
				headers?: Record<string, string>;
				body?: string;
				acceptedStatusCodes?: string;
				keyword?: string;
				jsonPath?: string;
				expectedValue?: string;
				checkSsl?: boolean;
				sslCertExpiryNotificationDays?: number;
			};
			return {
				id: m.id,
				type: m.type,
				url: config.url || "",
				hostname: config.hostname || "",
				port: config.port || 0,
				interval: m.interval,
				timeout: m.timeout,
				method: config.method || "GET",
				headers: config.headers || {},
				body: config.body,
				acceptedStatusCodes: config.acceptedStatusCodes,
				keyword: config.keyword,
				jsonPath: config.jsonPath,
				expectedValue: config.expectedValue,
				checkSsl: config.checkSsl ?? true,
				sslCertExpiryNotificationDays:
					config.sslCertExpiryNotificationDays ?? 30,
			};
		});
}

/**
 * Process a batch of monitor events for a given worker location, persisting monitor changes, creating or resolving incidents, recording incident activities, and storing raw events.
 *
 * @param events - Array of monitor events to process
 * @param workerLocation - Worker location used as the event location when an event does not include one
 * @returns An object with `success: true` and `count` equal to the number of processed events
 */
export async function processMonitorEvents(
	events: MonitorEvent[],
	workerId: string,
) {
	// Group events by monitor
	const eventsByMonitor = new Map<string, MonitorEvent[]>();
	for (const event of events) {
		const list = eventsByMonitor.get(event.monitorId) || [];
		list.push(event);
		eventsByMonitor.set(event.monitorId, list);
	}

	const changesToInsert: MonitorChangeInsert[] = [];
	const incidentsToInsert: (typeof incident.$inferInsert)[] = [];
	const incidentMonitorsToInsert: (typeof incidentMonitor.$inferInsert)[] = [];
	const incidentStatusPagesToInsert: (typeof incidentStatusPage.$inferInsert)[] =
		[];
	const activitiesToInsert: (typeof incidentActivity.$inferInsert)[] = [];

	for (const [monitorId, monitorEvents] of eventsByMonitor.entries()) {
		await processMonitorEventGroup(
			monitorId,
			monitorEvents,
			workerId,
			changesToInsert,
			incidentsToInsert,
			incidentMonitorsToInsert,
			incidentStatusPagesToInsert,
			activitiesToInsert,
		);
	}

	// Batch inserts
	if (changesToInsert.length > 0) {
		await clickhouse.insert({
			table: "uptimekit.monitor_changes",
			values: changesToInsert.map((c) => ({
				...c,
				timestamp: c.timestamp.getTime(),
			})),
			format: "JSONEachRow",
		});
	}

	if (incidentsToInsert.length > 0) {
		await db.insert(incident).values(incidentsToInsert);
		for (const inc of incidentsToInsert) {
			eventBus.emit("incident.created", {
				incidentId: inc.id,
				organizationId: inc.organizationId,
				title: inc.title,
				description: inc.description,
				severity: inc.severity as any,
			});
		}
	}

	if (incidentMonitorsToInsert.length > 0) {
		await db.insert(incidentMonitor).values(incidentMonitorsToInsert);
	}

	if (incidentStatusPagesToInsert.length > 0) {
		await db.insert(incidentStatusPage).values(incidentStatusPagesToInsert);
	}

	if (activitiesToInsert.length > 0) {
		await db.insert(incidentActivity).values(activitiesToInsert);
	}

	// Insert events to ClickHouse
	if (events.length > 0) {
		await clickhouse.insert({
			table: "uptimekit.monitor_events",
			values: events.map((e) => ({
				id: crypto.randomUUID(),
				monitorId: e.monitorId,
				status: e.status,
				latency: e.latency,
				timestamp: new Date(e.timestamp).getTime(),
				statusCode: e.statusCode,
				error: e.error,
				location: e.location || workerId,
				dnsLookup: e.timings?.dnsLookup,
				tcpConnect: e.timings?.tcpConnect,
				tlsHandshake: e.timings?.tlsHandshake,
				ttfb: e.timings?.ttfb,
				transfer: e.timings?.transfer,
			})),
			format: "JSONEachRow",
		});
	}

	return { success: true, count: events.length };
}

/**
 * Processes a batch of events for a single monitor, producing monitor change records,
 * opening or resolving automatic incidents based on the monitor's pending duration,
 * and recording incident-monitor mappings and incident activities. May emit incident events and update incident rows in the database.
 *
 * @param monitorId - ID of the monitor whose events are being processed
 * @param monitorEvents - Chronologically ordered (will be sorted if not) events for the monitor
 * @param workerLocation - Location identifier of the worker processing the events; used as a fallback event location
 * @param changesToInsert - Array that will be appended with MonitorChangeInsert entries to persist monitor status changes
 * @param incidentsToInsert - Array that will be appended with incident insert objects for newly created automatic incidents
 * @param incidentMonitorsToInsert - Array that will be appended with incident-monitor mapping entries for new incidents
 * @param activitiesToInsert - Array that will be appended with incident activity entries describing automated actions
 */
async function processMonitorEventGroup(
	monitorId: string,
	monitorEvents: MonitorEvent[],
	workerId: string,
	changesToInsert: MonitorChangeInsert[],
	incidentsToInsert: (typeof incident.$inferInsert)[],
	incidentMonitorsToInsert: (typeof incidentMonitor.$inferInsert)[],
	incidentStatusPagesToInsert: (typeof incidentStatusPage.$inferInsert)[],
	activitiesToInsert: (typeof incidentActivity.$inferInsert)[],
) {
	const monitorConfig = await db.query.monitor.findFirst({
		where: eq(monitor.id, monitorId),
	});

	if (!monitorConfig) {
		console.warn(`Received events for unknown monitor: ${monitorId}`);
		return;
	}

	// Check for active maintenance
	const activeMaintenance = await db
		.select({ id: maintenance.id })
		.from(maintenance)
		.innerJoin(
			maintenanceMonitor,
			eq(maintenance.id, maintenanceMonitor.maintenanceId),
		)
		.where(
			and(
				eq(maintenanceMonitor.monitorId, monitorId),
				eq(maintenance.status, "in_progress"),
			),
		)
		.limit(1);

	if (activeMaintenance.length > 0) {
		for (const event of monitorEvents) {
			event.status = "maintenance";
		}
	}

	// Fetch active automatic incident
	const activeIncidentList = await db
		.select({
			id: incident.id,
			status: incident.status,
			endedAt: incident.endedAt,
			type: incident.type,
		})
		.from(incident)
		.innerJoin(incidentMonitor, eq(incident.id, incidentMonitor.incidentId))
		.where(
			and(
				eq(incidentMonitor.monitorId, monitorId),
				eq(incident.type, "automatic"),
				isNull(incident.endedAt),
			),
		)
		.limit(1);

	let activeIncident: (typeof activeIncidentList)[0] | undefined =
		activeIncidentList[0];

	// Sort by timestamp
	monitorEvents.sort(
		(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
	);

	const monitorWorkerIds = Array.isArray(monitorConfig.workerIds)
		? monitorConfig.workerIds
		: [];
	const configuredWorkers =
		monitorWorkerIds.length > 0
			? await db
					.select({
						id: worker.id,
						name: worker.name,
						location: worker.location,
					})
					.from(worker)
					.where(inArray(worker.id, monitorWorkerIds))
			: Array.isArray(monitorConfig.locations) &&
					monitorConfig.locations.length > 0
				? await db
						.select({
							id: worker.id,
							name: worker.name,
							location: worker.location,
						})
						.from(worker)
						.where(
							inArray(worker.location, monitorConfig.locations as string[]),
						)
				: [];
	const configuredWorkerIds = configuredWorkers.map(
		(configuredWorker) => configuredWorker.id,
	);
	const workerLabels = new Map(
		configuredWorkers.map((workerRecord) => [
			workerRecord.id,
			`${workerRecord.name} (${workerRecord.location.toUpperCase()})`,
		]),
	);

	const latestRegionalStatusQuery = await clickhouse.query({
		query: `
			SELECT location, status, timestamp
			FROM (
				SELECT
					location,
					status,
					timestamp,
					ROW_NUMBER() OVER (PARTITION BY location ORDER BY timestamp DESC) AS rn
				FROM uptimekit.monitor_events
				WHERE monitorId = {monitorId:String}
			)
			WHERE rn = 1
		`,
		query_params: { monitorId },
		format: "JSON",
	});
	const latestRegionalStatusJson = await latestRegionalStatusQuery.json<any>();
	const latestRegionalStatuses = latestRegionalStatusJson.data as Array<{
		location: string;
		status: MonitorEvent["status"];
		timestamp: string;
	}>;
	const regionStatusByLocation = new Map<string, RegionStatusSnapshot>();
	for (const regionStatus of latestRegionalStatuses) {
		regionStatusByLocation.set(regionStatus.location, {
			status: regionStatus.status,
			timestamp: new Date(regionStatus.timestamp),
		});
	}

	// Get latest status from ClickHouse
	const lastEventQuery = await clickhouse.query({
		query:
			"SELECT status, timestamp FROM uptimekit.monitor_events WHERE monitorId = {monitorId:String} ORDER BY timestamp DESC LIMIT 1",
		query_params: { monitorId },
		format: "JSON",
	});
	const lastEventJson = await lastEventQuery.json<any>();
	const lastEvent = (lastEventJson.data as LatestEventResult[])[0];

	let currentStatus = lastEvent?.status;

	for (const event of monitorEvents) {
		const eventTime = new Date(event.timestamp);
		const eventLocation = event.location || workerId;
		const isChange =
			currentStatus !== undefined && currentStatus !== event.status;
		const isFirstEvent = currentStatus === undefined;

		if (isChange || isFirstEvent) {
			changesToInsert.push({
				id: crypto.randomUUID(),
				monitorId: event.monitorId,
				status: event.status,
				timestamp: eventTime,
				location: eventLocation,
			});
			currentStatus = event.status;
		}

		regionStatusByLocation.set(eventLocation, {
			status: event.status,
			timestamp: eventTime,
		});

		const configuredRegionStates = configuredWorkerIds
			.map((location) => regionStatusByLocation.get(location))
			.filter((state): state is RegionStatusSnapshot => !!state);

		const allRegionsReporting =
			configuredWorkerIds.length > 0 &&
			configuredRegionStates.length === configuredWorkerIds.length;
		const allRegionsDown =
			allRegionsReporting &&
			configuredRegionStates.every((state) => state.status === "down");

		// Automatic incidents only open when every configured region is currently down.
		if (allRegionsDown) {
			const allRegionsDownSince = new Date(
				Math.max(
					...configuredRegionStates.map((state) => state.timestamp.getTime()),
				),
			);
			const durationMs = eventTime.getTime() - allRegionsDownSince.getTime();
			const pendingMs = monitorConfig.incidentPendingDuration * 1000;

			if (durationMs >= pendingMs && !activeIncident) {
				const newIncidentId = crypto.randomUUID();
				activeIncident = {
					id: newIncidentId,
					status: "investigating",
					endedAt: null,
					type: "automatic",
				};

				incidentsToInsert.push({
					id: newIncidentId,
					organizationId: monitorConfig.organizationId,
					title: `Monitor ${monitorConfig.name} is down`,
					description: `Monitor ${monitorConfig.name} is down. \n\nError: ${event.error || "Unknown error"}`,
					status: "investigating",
					severity: "major",
					type: "automatic",
					startedAt: eventTime,
					endedAt: null,
					createdAt: eventTime,
					updatedAt: eventTime,
					resolvedAt: null,
				});

				incidentMonitorsToInsert.push({
					incidentId: newIncidentId,
					monitorId: monitorId,
				});

				if (monitorConfig.publishIncidentToStatusPage) {
					const statusPages = await db
						.select({
							statusPageId: statusPageMonitor.statusPageId,
						})
						.from(statusPageMonitor)
						.where(eq(statusPageMonitor.monitorId, monitorId));

					for (const { statusPageId } of statusPages) {
						incidentStatusPagesToInsert.push({
							incidentId: newIncidentId,
							statusPageId,
						});
					}

					if (statusPages.length > 0) {
						activitiesToInsert.push({
							id: crypto.randomUUID(),
							incidentId: newIncidentId,
							message: `Published to ${statusPages.length} status page${statusPages.length === 1 ? "" : "s"} automatically.`,
							type: "event",
							createdAt: eventTime,
							userId: null,
						});
					}
				}

				activitiesToInsert.push({
					id: crypto.randomUUID(),
					incidentId: newIncidentId,
					message: `Incident opened automatically. All configured workers are reporting down. Last failure: ${event.error || "unknown error"}. (Worker: ${workerLabels.get(eventLocation) || eventLocation})`,
					type: "event",
					createdAt: eventTime,
					userId: null,
				});
			}
		} else if (activeIncident) {
			await db
				.update(incident)
				.set({
					status: "resolved",
					endedAt: eventTime,
					resolvedAt: eventTime,
					updatedAt: eventTime,
				})
				.where(eq(incident.id, activeIncident.id));

			eventBus.emit("incident.resolved", {
				incidentId: activeIncident.id,
				organizationId: monitorConfig.organizationId,
				title: `Monitor ${monitorConfig.name} recovered`,
				description: "Monitor is back up.",
				severity: "major",
			});

			activitiesToInsert.push({
				id: crypto.randomUUID(),
				incidentId: activeIncident.id,
				message:
					"Monitor recovered in at least one region. Incident resolved automatically.",
				type: "event",
				createdAt: eventTime,
				userId: null,
			});

			activeIncident = undefined;
		}
	}
}
