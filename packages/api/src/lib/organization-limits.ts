import { ORPCError } from "@orpc/server";
import { db } from "@uptimekit/db";
import { organization } from "@uptimekit/db/schema/auth";
import {
	incident,
	incidentActivity,
	incidentMonitor,
	incidentStatusPage,
} from "@uptimekit/db/schema/incidents";
import { monitor } from "@uptimekit/db/schema/monitors";
import { and, asc, count, eq, inArray, isNull, notInArray } from "drizzle-orm";

export const QUOTA_PAUSE_REASONS = {
	activeMonitorLimit: "org_active_monitor_limit",
	regionsPerMonitorLimit: "org_region_limit",
} as const;

export type QuotaPauseReason =
	(typeof QUOTA_PAUSE_REASONS)[keyof typeof QUOTA_PAUSE_REASONS];

type TransactionLike = Parameters<Parameters<typeof db.transaction>[0]>[0];
type QueryableDatabase = typeof db | TransactionLike;

export type OrganizationQuotaState = {
	organizationId: string;
	activeMonitorLimit: number | null;
	regionsPerMonitorLimit: number | null;
	activeMonitorCount: number;
	totalMonitorCount: number;
};

export async function getOrganizationQuotaState(
	organizationId: string,
	database: QueryableDatabase = db,
): Promise<OrganizationQuotaState> {
	const [
		organizationRecord,
		activeMonitorCountResult,
		totalMonitorCountResult,
	] = await Promise.all([
		database.query.organization.findFirst({
			where: eq(organization.id, organizationId),
			columns: {
				id: true,
				activeMonitorLimit: true,
				regionsPerMonitorLimit: true,
			},
		}),
		database
			.select({ count: count() })
			.from(monitor)
			.where(
				and(
					eq(monitor.organizationId, organizationId),
					eq(monitor.active, true),
				),
			),
		database
			.select({ count: count() })
			.from(monitor)
			.where(eq(monitor.organizationId, organizationId)),
	]);

	if (!organizationRecord) {
		throw new ORPCError("NOT_FOUND", {
			message: "Organization not found.",
		});
	}

	return {
		organizationId: organizationRecord.id,
		activeMonitorLimit: organizationRecord.activeMonitorLimit,
		regionsPerMonitorLimit: organizationRecord.regionsPerMonitorLimit,
		activeMonitorCount: activeMonitorCountResult[0]?.count ?? 0,
		totalMonitorCount: totalMonitorCountResult[0]?.count ?? 0,
	};
}

export async function enforceMonitorQuotaOrThrow(input: {
	organizationId: string;
	nextLocations: string[];
	nextActive: boolean;
	excludeMonitorId?: string;
	database?: QueryableDatabase;
}) {
	const {
		organizationId,
		nextLocations,
		nextActive,
		excludeMonitorId,
		database = db,
	} = input;

	const quotaState = await getOrganizationQuotaState(organizationId, database);

	if (
		quotaState.regionsPerMonitorLimit !== null &&
		nextLocations.length > quotaState.regionsPerMonitorLimit
	) {
		throw new ORPCError("FORBIDDEN", {
			message: `This organization allows at most ${quotaState.regionsPerMonitorLimit} region(s) per monitor.`,
		});
	}

	if (!nextActive) {
		return quotaState;
	}

	if (quotaState.activeMonitorLimit !== null) {
		const activeMonitorCount = await countOtherActiveMonitors(
			organizationId,
			excludeMonitorId,
			database,
		);

		if (activeMonitorCount >= quotaState.activeMonitorLimit) {
			throw new ORPCError("FORBIDDEN", {
				message: `This organization allows at most ${quotaState.activeMonitorLimit} active monitor(s).`,
			});
		}
	}

	return quotaState;
}

export async function applyOrganizationLimitChanges(input: {
	organizationId: string;
	activeMonitorLimit: number | null;
	regionsPerMonitorLimit: number | null;
	database?: QueryableDatabase;
}) {
	const { organizationId, activeMonitorLimit, regionsPerMonitorLimit } = input;
	const database = input.database ?? db;

	return database.transaction(async (tx) => {
		await tx
			.update(organization)
			.set({
				activeMonitorLimit,
				regionsPerMonitorLimit,
			})
			.where(eq(organization.id, organizationId));

		const allActiveMonitors = await tx.query.monitor.findMany({
			where: and(
				eq(monitor.organizationId, organizationId),
				eq(monitor.active, true),
			),
			columns: {
				id: true,
				name: true,
				createdAt: true,
				locations: true,
			},
			orderBy: [asc(monitor.createdAt), asc(monitor.id)],
		});

		const regionOverflowMonitors =
			regionsPerMonitorLimit === null
				? []
				: allActiveMonitors.filter(
						(record) =>
							(record.locations as string[]).length > regionsPerMonitorLimit,
					);

		const regionPauseStats = await pauseMonitorsForQuota({
			organizationId,
			reason: QUOTA_PAUSE_REASONS.regionsPerMonitorLimit,
			monitorIds: regionOverflowMonitors.map((record) => record.id),
			database: tx,
		});

		const remainingActiveMonitors = allActiveMonitors.filter(
			(record) =>
				!regionOverflowMonitors.some((paused) => paused.id === record.id),
		);
		const activeOverflowCount =
			activeMonitorLimit === null
				? 0
				: Math.max(remainingActiveMonitors.length - activeMonitorLimit, 0);

		const oldestMonitorsToPause =
			activeOverflowCount > 0
				? remainingActiveMonitors.slice(0, activeOverflowCount)
				: [];

		const activePauseStats = await pauseMonitorsForQuota({
			organizationId,
			reason: QUOTA_PAUSE_REASONS.activeMonitorLimit,
			monitorIds: oldestMonitorsToPause.map((record) => record.id),
			database: tx,
		});

		return {
			activeMonitorLimit,
			regionsPerMonitorLimit,
			autoPausedMonitorCount:
				regionPauseStats.pausedMonitorCount +
				activePauseStats.pausedMonitorCount,
			unpublishedIncidentCount:
				regionPauseStats.unpublishedIncidentCount +
				activePauseStats.unpublishedIncidentCount,
		};
	});
}

async function countOtherActiveMonitors(
	organizationId: string,
	excludeMonitorId: string | undefined,
	database: QueryableDatabase,
) {
	const filters = [
		eq(monitor.organizationId, organizationId),
		eq(monitor.active, true),
	];

	if (excludeMonitorId) {
		filters.push(notInArray(monitor.id, [excludeMonitorId]));
	}

	const [result] = await database
		.select({ count: count() })
		.from(monitor)
		.where(and(...filters));

	return result?.count ?? 0;
}

async function pauseMonitorsForQuota(input: {
	organizationId: string;
	reason: QuotaPauseReason;
	monitorIds: string[];
	database: QueryableDatabase;
}) {
	const { organizationId, reason, monitorIds, database } = input;

	if (monitorIds.length === 0) {
		return {
			pausedMonitorCount: 0,
			unpublishedIncidentCount: 0,
		};
	}

	await database
		.update(monitor)
		.set({
			active: false,
			pauseReason: reason,
		})
		.where(
			and(
				eq(monitor.organizationId, organizationId),
				inArray(monitor.id, monitorIds),
				eq(monitor.active, true),
			),
		);

	const activeAutomaticIncidents = await database
		.select({
			incidentId: incident.id,
			monitorId: incidentMonitor.monitorId,
		})
		.from(incident)
		.innerJoin(incidentMonitor, eq(incident.id, incidentMonitor.incidentId))
		.where(
			and(
				eq(incident.organizationId, organizationId),
				eq(incident.type, "automatic"),
				isNull(incident.endedAt),
				inArray(incidentMonitor.monitorId, monitorIds),
			),
		);

	const incidentIds = [
		...new Set(activeAutomaticIncidents.map((row) => row.incidentId)),
	];

	let unpublishedIncidentCount = 0;

	if (incidentIds.length > 0) {
		const unpublishedLinks = await database
			.delete(incidentStatusPage)
			.where(inArray(incidentStatusPage.incidentId, incidentIds))
			.returning({ incidentId: incidentStatusPage.incidentId });

		unpublishedIncidentCount = unpublishedLinks.length;

		await database.insert(incidentActivity).values(
			incidentIds.map((incidentId) => ({
				id: crypto.randomUUID(),
				incidentId,
				message: getQuotaPauseActivityMessage(reason),
				type: "event",
				createdAt: new Date(),
				userId: null,
			})),
		);
	}

	return {
		pausedMonitorCount: monitorIds.length,
		unpublishedIncidentCount,
	};
}

function getQuotaPauseActivityMessage(reason: QuotaPauseReason) {
	if (reason === QUOTA_PAUSE_REASONS.activeMonitorLimit) {
		return "Monitor status page publishing was removed because the monitor was auto-paused after the organization active monitor limit was lowered.";
	}

	return "Monitor status page publishing was removed because the monitor was auto-paused after the organization region limit was lowered.";
}
