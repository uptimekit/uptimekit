import type {
	IncidentDetailData,
	MaintenanceDetailData,
	UpdatesPageData,
} from "@/themes/types";
import {
	getActiveMaintenances,
	getActiveStatusPageReports,
	getMaintenanceHistory,
	getMaintenanceHistoryForPeriod,
	getScheduledMaintenances,
	getStatusPageReports,
	getStatusPageReportsForPeriod,
} from "./db-queries";
import type { IncidentHistoryPeriod } from "./incident-history";
import { buildPath } from "./route-utils";

function getBarDays(design: any): 30 | 60 | 90 {
	if (
		design?.barDays === 30 ||
		design?.barDays === 60 ||
		design?.barDays === 90
	) {
		return design.barDays;
	}
	return 90;
}

function mapIncident(report: any, slug?: string) {
	return {
		id: report.id,
		title: report.title,
		status: report.status,
		severity: report.severity,
		startedAt: report.startedAt,
		endedAt: report.endedAt,
		monitors: report.affectedMonitors.map((am: any) => ({
			monitor: am.monitor,
		})),
		activities: report.updates.map((u: any) => ({
			id: u.id,
			message: u.message,
			createdAt: u.createdAt,
			type: u.type,
		})),
		detailsLink: buildPath(`/incidents/${report.id}`, slug),
	};
}

function mapMaintenanceIncident(maintenance: any, slug?: string) {
	return {
		id: maintenance.id,
		title: maintenance.title,
		status: maintenance.status,
		severity: "maintenance",
		startedAt: maintenance.createdAt,
		endedAt: maintenance.endAt,
		monitors: maintenance.monitors,
		activities: [],
		detailsLink: buildPath(`/maintenance/${maintenance.id}`, slug),
	};
}

export async function prepareIncidentDetailData(
	pageConfig: any,
	incidentId: string,
	slug?: string,
): Promise<IncidentDetailData> {
	const [reports, activeReports, activeMaintenances] = await Promise.all([
		getStatusPageReports(pageConfig.id, 1000),
		getActiveStatusPageReports(pageConfig.id),
		getActiveMaintenances(pageConfig.id),
	]);

	const reportItem =
		activeReports.find((r: any) => r.id === incidentId) ||
		reports.find((r: any) => r.id === incidentId);

	if (!reportItem) {
		throw new Error("Incident not found");
	}

	const activeIssues = [
		...activeReports.map((report: any) => mapIncident(report, slug)),
		...activeMaintenances.map((maintenance: any) =>
			mapMaintenanceIncident(maintenance, slug),
		),
	].sort(
		(a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
	);

	const design = (pageConfig.design as any) || {};
	const barDays = getBarDays(design);

	return {
		config: {
			id: pageConfig.id,
			name: pageConfig.name,
			slug: pageConfig.slug,
			design: {
				themeId: design.themeId || "default",
				theme: design.theme,
				logoUrl: design.logoUrl,
				faviconUrl: design.faviconUrl,
				contactUrl: design.contactUrl,
				customCss: design.customCss,
				headerLayout: design.headerLayout || "vertical",
				barStyle: design.barStyle || "normal",
				barDays,
			},
		},
		incident: mapIncident(reportItem, slug),
		activeIssues,
	};
}

export async function prepareMaintenanceDetailData(
	pageConfig: any,
	maintenanceId: string,
	slug?: string,
): Promise<MaintenanceDetailData> {
	const [history, activeReports, activeMaintenances, scheduledMaintenances] =
		await Promise.all([
			getMaintenanceHistory(pageConfig.id, 1000),
			getActiveStatusPageReports(pageConfig.id),
			getActiveMaintenances(pageConfig.id),
			getScheduledMaintenances(pageConfig.id),
		]);

	const maintenanceItem =
		activeMaintenances.find((m: any) => m.id === maintenanceId) ||
		scheduledMaintenances.find((m: any) => m.id === maintenanceId) ||
		history.find((m: any) => m.id === maintenanceId);

	if (!maintenanceItem) {
		throw new Error("Maintenance not found");
	}

	const maintenance = {
		id: maintenanceItem.id,
		title: maintenanceItem.title,
		description:
			("description" in maintenanceItem &&
			typeof maintenanceItem.description === "string"
				? maintenanceItem.description
				: null) || null,
		status: maintenanceItem.status,
		startAt:
			maintenanceItem.status === "scheduled"
				? maintenanceItem.startAt
				: maintenanceItem.createdAt,
		endAt: maintenanceItem.endAt,
		createdAt: maintenanceItem.createdAt,
		monitors: maintenanceItem.monitors,
		detailsLink: buildPath(`/maintenance/${maintenanceItem.id}`, slug),
	};

	const activeIssues = [
		...activeReports.map((report: any) => mapIncident(report, slug)),
		...activeMaintenances
			.filter((item: any) => item.id !== maintenanceId)
			.map((item: any) => mapMaintenanceIncident(item, slug)),
	].sort(
		(a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
	);

	const design = (pageConfig.design as any) || {};
	const barDays = getBarDays(design);

	return {
		config: {
			id: pageConfig.id,
			name: pageConfig.name,
			slug: pageConfig.slug,
			design: {
				themeId: design.themeId || "default",
				theme: design.theme,
				logoUrl: design.logoUrl,
				faviconUrl: design.faviconUrl,
				contactUrl: design.contactUrl,
				customCss: design.customCss,
				headerLayout: design.headerLayout || "vertical",
				barStyle: design.barStyle || "normal",
				barDays,
			},
		},
		maintenance,
		activeIssues,
	};
}

export async function prepareUpdatesPageData(
	pageConfig: any,
	selectedPeriod: IncidentHistoryPeriod,
	slug?: string,
): Promise<UpdatesPageData> {
	const limit = selectedPeriod === "all" ? undefined : 50;
	const [reports, maintenances, activeReports, activeMaintenances] =
		await Promise.all([
			getStatusPageReportsForPeriod(pageConfig.id, {
				limit,
				period: selectedPeriod,
			}),
			getMaintenanceHistoryForPeriod(pageConfig.id, {
				limit,
				period: selectedPeriod,
			}),
			getActiveStatusPageReports(pageConfig.id),
			getActiveMaintenances(pageConfig.id),
		]);

	const allUpdates = [
		...reports.map((report: any) => mapIncident(report, slug)),
		...maintenances.map((maintenance: any) =>
			mapMaintenanceIncident(maintenance, slug),
		),
	].sort(
		(a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
	);

	const incidentsByDate = allUpdates.reduce(
		(acc, item) => {
			const date = new Date(item.startedAt).toLocaleDateString("en-US", {
				month: "long",
				day: "numeric",
				year: "numeric",
			});
			if (!acc[date]) {
				acc[date] = [];
			}
			acc[date].push(item);
			return acc;
		},
		{} as Record<string, typeof allUpdates>,
	);

	const activeIssues = [
		...activeReports.map((report: any) => mapIncident(report, slug)),
		...activeMaintenances.map((maintenance: any) =>
			mapMaintenanceIncident(maintenance, slug),
		),
	].sort(
		(a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
	);

	const design = (pageConfig.design as any) || {};
	const barDays = getBarDays(design);

	return {
		config: {
			id: pageConfig.id,
			name: pageConfig.name,
			slug: pageConfig.slug,
			design: {
				themeId: design.themeId || "default",
				theme: design.theme,
				logoUrl: design.logoUrl,
				faviconUrl: design.faviconUrl,
				contactUrl: design.contactUrl,
				customCss: design.customCss,
				headerLayout: design.headerLayout || "vertical",
				barStyle: design.barStyle || "normal",
				barDays,
			},
		},
		allUpdates,
		incidentsByDate,
		activeIssues,
		selectedPeriod,
	};
}
