import { clickhouse, db } from "@uptimekit/db";
import {
	incident,
	incidentActivity,
	incidentMonitor,
} from "@uptimekit/db/schema/incidents";
import {
	maintenance,
	maintenanceMonitor,
} from "@uptimekit/db/schema/maintenance";
import { monitor } from "@uptimekit/db/schema/monitors";
import { and, eq, isNull } from "drizzle-orm";
import { eventBus } from "../../lib/events";
import type {
	LatestChangeResult,
	LatestEventResult,
} from "../../types/clickhouse";

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

/**
 * Retrieve active monitors assigned to the given worker location and return their runtime configuration.
 *
 * @param workerLocation - The worker location identifier used to filter monitors whose `locations` include this value
 * @returns An array of monitor configuration objects containing: `id`, `type`, `url` (defaults to `""`), `hostname` (defaults to `""`), `port` (defaults to `0`), `interval`, `timeout`, `method` (defaults to `"GET"`), `headers` (defaults to `{}`), `body`, `acceptedStatusCodes`, `keyword`, `jsonPath`, `expectedValue`, `checkSsl` (defaults to `true`), and `sslCertExpiryNotificationDays` (defaults to `30`)
 */
export async function getMonitorsForWorker(workerLocation: string) {
	const allActiveMonitors = await db.query.monitor.findMany({
		where: (t, { eq }) => eq(t.active, true),
	});

	return allActiveMonitors
		.filter((m) => {
			const locations = m.locations as string[];
			return locations.includes(workerLocation);
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
	workerLocation: string,
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
	const activitiesToInsert: (typeof incidentActivity.$inferInsert)[] = [];

	for (const [monitorId, monitorEvents] of eventsByMonitor.entries()) {
		await processMonitorEventGroup(
			monitorId,
			monitorEvents,
			workerLocation,
			changesToInsert,
			incidentsToInsert,
			incidentMonitorsToInsert,
			activitiesToInsert,
		);
	}

	// Batch inserts
	if (changesToInsert.length > 0) {
		await clickhouse.insert({
			table: "uptimekit.monitor_changes",
			values: changesToInsert.map((c) => ({
				...c,
				timestamp: new Date(c.timestamp!).getTime(),
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
				location: e.location || workerLocation,
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
	workerLocation: string,
	changesToInsert: MonitorChangeInsert[],
	incidentsToInsert: (typeof incident.$inferInsert)[],
	incidentMonitorsToInsert: (typeof incidentMonitor.$inferInsert)[],
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
			resolvedAt: incident.resolvedAt,
			type: incident.type,
		})
		.from(incident)
		.innerJoin(incidentMonitor, eq(incident.id, incidentMonitor.incidentId))
		.where(
			and(
				eq(incidentMonitor.monitorId, monitorId),
				eq(incident.type, "automatic"),
				isNull(incident.resolvedAt),
			),
		)
		.limit(1);

	let activeIncident: (typeof activeIncidentList)[0] | undefined =
		activeIncidentList[0];

	// Sort by timestamp
	monitorEvents.sort(
		(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
	);

	// Get latest status from ClickHouse
	const lastEventQuery = await clickhouse.query({
		query:
			"SELECT status, timestamp FROM uptimekit.monitor_events WHERE monitorId = {monitorId:String} ORDER BY timestamp DESC LIMIT 1",
		query_params: { monitorId },
		format: "JSON",
	});
	const lastEventJson = await lastEventQuery.json<any>();
	const lastEvent = (lastEventJson.data as LatestEventResult[])[0];

	const lastChangeQuery = await clickhouse.query({
		query:
			"SELECT status, timestamp FROM uptimekit.monitor_changes WHERE monitorId = {monitorId:String} ORDER BY timestamp DESC LIMIT 1",
		query_params: { monitorId },
		format: "JSON",
	});
	const lastChangeJson = await lastChangeQuery.json<any>();
	const lastChangeRecord = (lastChangeJson.data as LatestChangeResult[])[0];

	let currentStatus = lastEvent?.status;
	let lastChangeTime = lastChangeRecord?.timestamp
		? new Date(lastChangeRecord.timestamp)
		: lastEvent?.timestamp
			? new Date(lastEvent.timestamp)
			: new Date();

	for (const event of monitorEvents) {
		const eventTime = new Date(event.timestamp);
		const isChange =
			currentStatus !== undefined && currentStatus !== event.status;
		const isFirstEvent = currentStatus === undefined;

		if (isChange || isFirstEvent) {
			changesToInsert.push({
				id: crypto.randomUUID(),
				monitorId: event.monitorId,
				status: event.status,
				timestamp: eventTime,
				location: event.location || workerLocation,
			});
			currentStatus = event.status;
			lastChangeTime = eventTime;
		}

		// Incident logic
		if (currentStatus === "down") {
			const durationMs = eventTime.getTime() - lastChangeTime.getTime();
			const pendingMs = monitorConfig.incidentPendingDuration * 1000;

			if (durationMs >= pendingMs && !activeIncident) {
				const newIncidentId = crypto.randomUUID();
				activeIncident = {
					id: newIncidentId,
					status: "investigating",
					resolvedAt: null,
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
					createdAt: eventTime,
					updatedAt: eventTime,
				});

				incidentMonitorsToInsert.push({
					incidentId: newIncidentId,
					monitorId: monitorId,
				});

				activitiesToInsert.push({
					id: crypto.randomUUID(),
					incidentId: newIncidentId,
					message: `Incident opened automatically. Monitor reported down due to: ${event.error || "unknown error"}. (Region: ${event.location || workerLocation})`,
					type: "event",
					createdAt: eventTime,
					userId: null,
				});
			}
		} else if (currentStatus === "up" && activeIncident) {
			await db
				.update(incident)
				.set({
					status: "resolved",
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
				message: "Monitor recovered. Incident resolved automatically.",
				type: "event",
				createdAt: eventTime,
				userId: null,
			});

			activeIncident = undefined;
		}
	}
}

// Network Loss Alert Types
export interface NetworkLossAlert {
	monitorId: string;
	timestamp: string;
	averagePacketLoss: number;
	threshold: number;
	target: string;
	alertType: "triggered" | "resolved";
	packetsSent: number;
	packetsReceived: number;
}

export interface NetworkLossMonitorConfig {
	id: string;
	target: string;
	threshold: number;
	packetCount: number;
	interval: number;
	incidentPendingDuration: number;
	incidentRecoveryDuration: number;
}

/**
 * Retrieve active network-loss monitors assigned to the given worker location.
 *
 * @param workerLocation - The worker location identifier used to filter monitors whose `locations` include this value
 * @returns An array of network-loss monitor configuration objects
 */
export async function getNetworkLossMonitorsForWorker(
	workerLocation: string,
): Promise<NetworkLossMonitorConfig[]> {
	const allActiveMonitors = await db.query.monitor.findMany({
		where: (t, { eq, and }) =>
			and(eq(t.active, true), eq(t.type, "network-loss")),
	});

	return allActiveMonitors
		.filter((m) => {
			const locations = m.locations as string[];
			return locations.includes(workerLocation);
		})
		.map((m) => {
			const config = m.config as {
				target?: string;
				threshold?: number;
				packetCount?: number;
			};
			return {
				id: m.id,
				target: config.target || "",
				threshold: config.threshold ?? 10,
				packetCount: config.packetCount ?? 10,
				interval: m.interval,
				incidentPendingDuration: m.incidentPendingDuration,
				incidentRecoveryDuration: m.incidentRecoveryDuration,
			};
		});
}

/**
 * Process a network-loss alert event from a worker.
 *
 * @param alert - The network-loss alert data from the worker
 * @param workerLocation - The worker location that sent the alert
 * @returns Result object indicating the action taken
 */
export async function processNetworkLossEvent(
	alert: NetworkLossAlert,
	workerLocation: string,
): Promise<{
	success: boolean;
	action:
		| "incident_created"
		| "incident_resolved"
		| "no_action"
		| "monitor_not_found"
		| "location_mismatch"
		| "maintenance_active";
}> {
	const monitorConfig = await db.query.monitor.findFirst({
		where: eq(monitor.id, alert.monitorId),
	});

	if (!monitorConfig) {
		return { success: false, action: "monitor_not_found" };
	}

	const locations = monitorConfig.locations as string[];
	if (!locations.includes(workerLocation)) {
		return { success: false, action: "location_mismatch" };
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
				eq(maintenanceMonitor.monitorId, alert.monitorId),
				eq(maintenance.status, "in_progress"),
			),
		)
		.limit(1);

	if (activeMaintenance.length > 0) {
		return { success: true, action: "maintenance_active" };
	}

	const eventTime = new Date(alert.timestamp);

	// Fetch active automatic incident for this monitor
	const activeIncidentList = await db
		.select({
			id: incident.id,
			status: incident.status,
			resolvedAt: incident.resolvedAt,
			type: incident.type,
		})
		.from(incident)
		.innerJoin(incidentMonitor, eq(incident.id, incidentMonitor.incidentId))
		.where(
			and(
				eq(incidentMonitor.monitorId, alert.monitorId),
				eq(incident.type, "automatic"),
				isNull(incident.resolvedAt),
			),
		)
		.limit(1);

	const activeIncident = activeIncidentList[0];

	if (alert.alertType === "triggered") {
		if (activeIncident) {
			return { success: true, action: "no_action" };
		}

		const newIncidentId = crypto.randomUUID();

		await db.insert(incident).values({
			id: newIncidentId,
			organizationId: monitorConfig.organizationId,
			title: `Network packet loss detected on ${monitorConfig.name}`,
			description: `${alert.averagePacketLoss}% packet loss to ${alert.target} (threshold: ${alert.threshold}%)`,
			status: "investigating",
			severity: "major",
			type: "automatic",
			createdAt: eventTime,
			updatedAt: eventTime,
		});

		await db.insert(incidentMonitor).values({
			incidentId: newIncidentId,
			monitorId: alert.monitorId,
		});

		await db.insert(incidentActivity).values({
			id: crypto.randomUUID(),
			incidentId: newIncidentId,
			message: `Incident opened automatically. Network packet loss detected: ${alert.averagePacketLoss}% to ${alert.target} (sent: ${alert.packetsSent}, received: ${alert.packetsReceived}). (Region: ${workerLocation})`,
			type: "event",
			createdAt: eventTime,
			userId: null,
		});

		eventBus.emit("incident.created", {
			incidentId: newIncidentId,
			organizationId: monitorConfig.organizationId,
			title: `Network packet loss detected on ${monitorConfig.name}`,
			description: `${alert.averagePacketLoss}% packet loss to ${alert.target} (threshold: ${alert.threshold}%)`,
			severity: "major",
		});

		return { success: true, action: "incident_created" };
	}

	if (alert.alertType === "resolved") {
		if (!activeIncident) {
			return { success: true, action: "no_action" };
		}

		await db
			.update(incident)
			.set({
				status: "resolved",
				resolvedAt: eventTime,
				updatedAt: eventTime,
			})
			.where(eq(incident.id, activeIncident.id));

		await db.insert(incidentActivity).values({
			id: crypto.randomUUID(),
			incidentId: activeIncident.id,
			message: `Network packet loss recovered. Current loss: ${alert.averagePacketLoss}% to ${alert.target}. Incident resolved automatically.`,
			type: "event",
			createdAt: eventTime,
			userId: null,
		});

		eventBus.emit("incident.resolved", {
			incidentId: activeIncident.id,
			organizationId: monitorConfig.organizationId,
			title: `Network packet loss recovered on ${monitorConfig.name}`,
			description: `Packet loss to ${alert.target} has recovered below threshold.`,
			severity: "major",
		});

		return { success: true, action: "incident_resolved" };
	}

	return { success: true, action: "no_action" };
}
