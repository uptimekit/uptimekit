import type {
	IncidentDetailData,
	MaintenanceDetailData,
	UpdatesPageData,
} from "@/themes/types";
import {
	getActiveMaintenances,
	getActiveStatusPageReports,
	getMaintenanceHistory,
	getScheduledMaintenances,
	getStatusPageReports,
} from "./db-queries";
import { buildPath } from "./route-utils";

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

	const incident = {
		id: reportItem.id,
		title: reportItem.title,
		status: reportItem.status,
		severity: reportItem.severity,
		createdAt: reportItem.createdAt,
		resolvedAt: reportItem.resolvedAt,
		monitors: reportItem.affectedMonitors.map((am: any) => ({
			monitor: am.monitor,
		})),
		activities: reportItem.updates.map((u: any) => ({
			id: u.id,
			message: u.message,
			createdAt: u.createdAt,
			type: "update",
		})),
		detailsLink: buildPath(`/incidents/${reportItem.id}`, slug),
	};

	const activeIssues = [
		...activeReports.map((r: any) => ({
			id: r.id,
			title: r.title,
			status: r.status,
			severity: r.severity,
			createdAt: r.createdAt,
			resolvedAt: r.resolvedAt,
			monitors: r.affectedMonitors.map((am: any) => ({ monitor: am.monitor })),
			activities: r.updates.map((u: any) => ({
				id: u.id,
				message: u.message,
				createdAt: u.createdAt,
				type: "update",
			})),
			detailsLink: buildPath(`/incidents/${r.id}`, slug),
		})),
		...activeMaintenances.map((m: any) => ({
			id: m.id,
			title: m.title,
			status: m.status,
			severity: "maintenance",
			createdAt: m.createdAt,
			resolvedAt: m.endAt,
			monitors: m.monitors,
			activities: [],
			detailsLink: buildPath(`/maintenance/${m.id}`, slug),
		})),
	].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	const design = (pageConfig.design as any) || {};

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
			},
		},
		incident,
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
		description: (maintenanceItem as any).description || null,
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
		...activeReports.map((r: any) => ({
			id: r.id,
			title: r.title,
			status: r.status,
			severity: r.severity,
			createdAt: r.createdAt,
			resolvedAt: r.resolvedAt,
			monitors: r.affectedMonitors.map((am: any) => ({ monitor: am.monitor })),
			activities: r.updates.map((u: any) => ({
				id: u.id,
				message: u.message,
				createdAt: u.createdAt,
				type: "update",
			})),
			detailsLink: buildPath(`/incidents/${r.id}`, slug),
		})),
		...activeMaintenances
			.filter((m: any) => m.id !== maintenanceId)
			.map((m: any) => ({
				id: m.id,
				title: m.title,
				status: m.status,
				severity: "maintenance",
				createdAt: m.createdAt,
				resolvedAt: m.endAt,
				monitors: m.monitors,
				activities: [],
				detailsLink: buildPath(`/maintenance/${m.id}`, slug),
			})),
	].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	const design = (pageConfig.design as any) || {};

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
			},
		},
		maintenance,
		activeIssues,
	};
}

export async function prepareUpdatesPageData(
	pageConfig: any,
	slug?: string,
): Promise<UpdatesPageData> {
	const limit = 50;
	const [reports, maintenances, activeReports, activeMaintenances] =
		await Promise.all([
			getStatusPageReports(pageConfig.id, limit),
			getMaintenanceHistory(pageConfig.id, limit),
			getActiveStatusPageReports(pageConfig.id),
			getActiveMaintenances(pageConfig.id),
		]);

	const allUpdates = [
		...reports.map((r: any) => ({
			id: r.id,
			title: r.title,
			status: r.status,
			severity: r.severity,
			createdAt: r.createdAt,
			resolvedAt: r.resolvedAt,
			monitors: r.affectedMonitors.map((am: any) => ({ monitor: am.monitor })),
			activities: r.updates.map((u: any) => ({
				id: u.id,
				message: u.message,
				createdAt: u.createdAt,
				type: "update",
			})),
			detailsLink: buildPath(`/incidents/${r.id}`, slug),
		})),
		...maintenances.map((m: any) => ({
			id: m.id,
			title: m.title,
			status: m.status,
			severity: "maintenance",
			createdAt: m.createdAt,
			resolvedAt: m.endAt,
			monitors: m.monitors,
			activities: [],
			detailsLink: buildPath(`/maintenance/${m.id}`, slug),
		})),
	].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	const incidentsByDate = allUpdates.reduce(
		(acc, incident) => {
			const date = new Date(incident.createdAt).toLocaleDateString("en-US", {
				month: "long",
				day: "numeric",
				year: "numeric",
			});
			if (!acc[date]) {
				acc[date] = [];
			}
			acc[date].push(incident);
			return acc;
		},
		{} as Record<string, typeof allUpdates>,
	);

	const activeIssues = [
		...activeReports.map((r: any) => ({
			id: r.id,
			title: r.title,
			status: r.status,
			severity: r.severity,
			createdAt: r.createdAt,
			resolvedAt: r.resolvedAt,
			monitors: r.affectedMonitors.map((am: any) => ({ monitor: am.monitor })),
			activities: r.updates.map((u: any) => ({
				id: u.id,
				message: u.message,
				createdAt: u.createdAt,
				type: "update",
			})),
			detailsLink: buildPath(`/incidents/${r.id}`, slug),
		})),
		...activeMaintenances.map((m: any) => ({
			id: m.id,
			title: m.title,
			status: m.status,
			severity: "maintenance",
			createdAt: m.createdAt,
			resolvedAt: m.endAt,
			monitors: m.monitors,
			activities: [],
			detailsLink: buildPath(`/maintenance/${m.id}`, slug),
		})),
	].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	const design = (pageConfig.design as any) || {};

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
			},
		},
		allUpdates,
		incidentsByDate,
		activeIssues,
	};
}
