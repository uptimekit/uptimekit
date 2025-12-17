import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { IncidentCard } from "@/components/incident-card";
import { MonitorListItem } from "@/components/monitor-list-item";
import { OverallStatus } from "@/components/overall-status";
import type { StatusType } from "@/components/status-indicator";
import { ThemeSetter } from "@/components/theme-setter";
import type { UptimeDay } from "@/components/uptime-bar";
import {
	getActiveMaintenances,
	getActiveStatusPageReports,
	getMaintenanceHistory,
	getMonitorStatus,
	getMonitorUptime,
	getStatusPageByDomain,
	getStatusPageEvents,
	getStatusPageReports,
} from "@/lib/db-queries";

// Helper to calculate status based on stats
// This is a simplified logic. You might want to fine-tune it based on project requirements.
function calculateDailyStatus(total: number, up: number): StatusType {
	if (total === 0) return "unknown";
	const ratio = up / total;
	if (ratio < 0.8) return "major_outage";
	if (ratio < 0.95) return "partial_outage";
	if (ratio < 0.99) return "degraded";
	// Could also charge based on latency...
	return "operational";
}

function fillMissingDays(
	stats: {
		date: string;
		total_checks: number;
		up_checks: number;
	}[],
	days = 90,
): UptimeDay[] {
	const result: UptimeDay[] = [];
	const now = new Date();
	const statsMap = new Map(stats.map((s) => [s.date, s]));

	for (let i = days - 1; i >= 0; i--) {
		const d = new Date(now);
		d.setDate(d.getDate() - i);
		const dateStr = d.toISOString().split("T")[0];
		const stat = statsMap.get(dateStr);

		if (stat) {
			const uptime =
				stat.total_checks > 0 ? (stat.up_checks / stat.total_checks) * 100 : 0;
			result.push({
				date: dateStr,
				status: calculateDailyStatus(stat.total_checks, stat.up_checks),
				uptime: uptime,
			});
		} else {
			result.push({
				date: dateStr,
				status: "unknown", // Or 'operational' if we assume no news is good news? simpler to say unknown
				uptime: 0,
			});
		}
	}
	return result;
}

export default async function StatusPage() {
	const headersList = await headers();
	const host = headersList.get("host");

	if (!host) {
		notFound();
	}
	// Remove port if present for local dev match mostly, but production might strictly match
	const domain = host.split(":")[0];

	const pageConfig = await getStatusPageByDomain(domain);

	if (!pageConfig) {
		notFound();
	}

	const [activeReports, activeMaintenances] = await Promise.all([
		getActiveStatusPageReports(pageConfig.id),
		getActiveMaintenances(pageConfig.id),
	]);

	const [reports, maintenances, events] = await Promise.all([
		getStatusPageReports(pageConfig.id),
		getMaintenanceHistory(pageConfig.id),
		getStatusPageEvents(pageConfig.id, 90),
	]);

	const combinedActive = [
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
			detailsLink: `/incidents/${r.id}`,
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
			detailsLink: `/maintenance/${m.id}`,
		})),
	].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	const pastIncidents = [
		...reports.map((r) => ({
			id: r.id,
			title: r.title,
			status: r.status,
			severity: r.severity,
			createdAt: r.createdAt,
			resolvedAt: r.resolvedAt,
			monitors: r.affectedMonitors.map((am) => ({ monitor: am.monitor })),
			activities: r.updates.map((u) => ({
				id: u.id,
				message: u.message,
				createdAt: u.createdAt,
				type: "update",
			})),
			detailsLink: `/incidents/${r.id}`,
		})),
		...maintenances.map((m) => ({
			id: m.id,
			title: m.title,
			status: m.status,
			severity: "maintenance",
			createdAt: m.createdAt,
			resolvedAt: m.endAt,
			monitors: m.monitors.map((mm) => ({ monitor: mm.monitor })),
			activities: [],
			detailsLink: `/maintenance/${m.id}`,
		})),
	].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	// Fetch monitor data
	const monitorsData = await Promise.all(
		pageConfig.monitors.map(async (pm) => {
			const stats = await getMonitorUptime(pm.monitorId);

			// 1. Calculate Live Status
			let currentStatus: StatusType = "operational";

			// Check active maintenance
			const isUnderMaintenance = activeMaintenances.some((m) =>
				m.monitors.some((mm) => mm.monitorId === pm.monitorId),
			);
			if (isUnderMaintenance) {
				currentStatus = "maintenance" as any;
			}

			// Check active incidents (overrides maintenance if concurrent? usually yes)
			const activeReport = activeReports.find((r: any) =>
				r.affectedMonitors.some((am: any) => am.monitorId === pm.monitorId),
			);

			if (activeReport) {
				// Map severity to status
				if (activeReport.severity === "critical")
					currentStatus = "major_outage";
				else if (activeReport.severity === "major")
					currentStatus = "partial_outage";
				else if (activeReport.severity === "minor") currentStatus = "degraded";
			}

			// Check automated heartbeat status if no manual incident is active
			if (currentStatus === "operational") {
				const lastCheck = await getMonitorStatus(pm.monitorId);
				if (lastCheck) {
					if (lastCheck.status === "down") currentStatus = "major_outage";
					else if (lastCheck.status === "degraded") currentStatus = "degraded";
				}
			}

			let history = fillMissingDays(stats);

			// Overlay Manual Events (Maintenance & Incidents)
			history = history.map((day) => {
				const dayDate = new Date(day.date);
				dayDate.setHours(12, 0, 0, 0);

				// Check Maintenance
				const maintenance = events.maintenances.find((m) => {
					const affectsMonitor = m.monitors.some(
						(mm) => mm.monitorId === pm.monitorId,
					);
					if (!affectsMonitor) return false;

					const start = new Date(m.startAt);
					const end = m.endAt ? new Date(m.endAt) : new Date(); // If ongoing, use now
					start.setHours(0, 0, 0, 0);
					end.setHours(23, 59, 59, 999);

					return dayDate >= start && dayDate <= end;
				});

				// Check Incidents (Reports)
				const relevantReports = events.reports.filter((r) => {
					const affectsMonitor = r.affectedMonitors.some(
						(am) => am.monitorId === pm.monitorId,
					);
					if (!affectsMonitor) return false;

					const start = new Date(r.createdAt);
					const end = r.resolvedAt ? new Date(r.resolvedAt) : new Date();
					start.setHours(0, 0, 0, 0);
					end.setHours(23, 59, 59, 999);
					return dayDate >= start && dayDate <= end;
				});

				if (maintenance) {
					// Maintenance shouldn't penalty uptime for that day generally, or we show 100% but marked as maintenance
					return { ...day, status: "maintenance" as any, uptime: 100 };
				}

				if (relevantReports.length > 0) {
					// Find worst severity
					// Priority: critical > major > minor
					let worstReport = relevantReports[0];
					const severityMap: Record<string, number> = {
						minor: 1,
						major: 2,
						critical: 3,
					};
					let maxSeverity = 0;

					for (const r of relevantReports) {
						const val = severityMap[r.severity] || 0;
						if (val > maxSeverity) {
							maxSeverity = val;
							worstReport = r;
						}
					}

					let s: StatusType = "operational";
					let u = day.uptime;
					if (worstReport.severity === "critical") {
						s = "major_outage";
						u = 0;
					} else if (worstReport.severity === "major") {
						s = "partial_outage";
						u = Math.min(u, 50);
					} else if (worstReport.severity === "minor") {
						s = "degraded";
						u = Math.min(u, 80);
					}

					return { ...day, status: s, uptime: u };
				}

				return day;
			});

			// Enforce active status on 'today' for uptime calc
			const todayStr = new Date().toISOString().split("T")[0];
			history = history.map((d) => {
				if (d.date === todayStr) {
					if (currentStatus === "major_outage") {
						return { ...d, uptime: 0, status: "major_outage" };
					}
					if (currentStatus === "partial_outage") {
						return {
							...d,
							uptime: Math.min(d.uptime, 50),
							status: "partial_outage",
						};
					}
					if (currentStatus === "degraded") {
						// Optional: penalize ?
						// User said "also count as drop".
						return { ...d, status: "degraded", uptime: Math.min(d.uptime, 80) };
					}
				}
				return d;
			});

			const knownDays = history.filter(
				(d) => d.status !== "unknown" && d.status !== "maintenance",
			);
			const avgUptime =
				knownDays.length > 0
					? knownDays.reduce((acc, curr) => acc + curr.uptime, 0) /
						knownDays.length
					: 100;

			return {
				...pm.monitor,
				history,
				avgUptime,
				currentStatus,
				group: pm.group,
			};
		}),
	);

	// Group monitors by group ID
	const monitorsByGroup = monitorsData.reduce(
		(acc, monitor) => {
			const groupId = monitor.group?.id || "ungrouped";
			if (!acc[groupId]) {
				acc[groupId] = {
					group: monitor.group,
					monitors: [],
				};
			}
			acc[groupId].monitors.push(monitor);
			return acc;
		},
		{} as Record<
			string,
			{
				group: (typeof monitorsData)[0]["group"];
				monitors: typeof monitorsData;
			}
		>,
	);

	// Sort groups: Ungrouped first, then by order
	const sortedGroups = Object.values(monitorsByGroup).sort((a, b) => {
		if (!a.group) return -1;
		if (!b.group) return 1;
		return (a.group.order ?? 0) - (b.group.order ?? 0);
	});

	// Calculate Overall Status
	const worstStatus = monitorsData.reduce((acc, curr) => {
		if (curr.currentStatus === "major_outage") return "major_outage";
		if (acc === "major_outage") return acc;

		if (curr.currentStatus === "partial_outage") return "partial_outage";
		if (acc === "partial_outage") return acc;

		if (curr.currentStatus === "degraded") return "degraded";

		if (curr.currentStatus === "maintenance" && acc !== "degraded")
			return "maintenance";

		return acc;
	}, "operational" as StatusType);

	// Group incidents by date
	const incidentsByDate = pastIncidents.reduce(
		(acc, incident) => {
			const date = new Date(incident.createdAt).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
			});

			if (!acc[date]) {
				acc[date] = [];
			}
			acc[date].push(incident);
			return acc;
		},
		{} as Record<string, typeof pastIncidents>,
	);

	const design = (pageConfig.design as any) || {};

	return (
		<div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
			<ThemeSetter theme={design.theme} />
			<Header
				title={pageConfig.name}
				logoUrl={design.logoUrl}
				contactUrl={design.contactUrl}
			/>

			<main className="w-full flex-1">
				<div className="mx-auto max-w-5xl px-4 py-12">
					{/* Overall Status */}
					<section className="mb-16">
						<OverallStatus status={worstStatus} />
					</section>

					{/* Monitors List (Grouped) */}
					<section className="mb-16 space-y-8">
						{sortedGroups.map((group) => (
							<div
								key={group.group?.id || "ungrouped"}
								className="rounded-2xl border border-border bg-card p-6 shadow-sm"
							>
								{group.group && (
									<h3 className="mb-4 font-bold text-foreground text-xl">
										{group.group.name}
									</h3>
								)}
								<div className="divide-y divide-border">
									{group.monitors.map((monitor) => (
										<MonitorListItem
											key={monitor.id}
											name={monitor.name}
											status={monitor.currentStatus}
											uptimePercentage={monitor.avgUptime}
											history={monitor.history}
										/>
									))}
								</div>
							</div>
						))}
					</section>

					{/* Active Incidents & Maintenances */}
					{combinedActive.length > 0 && (
						<section className="mb-16 animate-slide-up">
							<h2 className="mb-6 flex items-center gap-3 font-bold text-2xl text-foreground">
								<span className="relative flex h-3 w-3">
									<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-major-outage opacity-75" />
									<span className="relative inline-flex h-3 w-3 rounded-full bg-status-major-outage" />
								</span>
								Current Issues
							</h2>
							<div className="space-y-6">
								{combinedActive.map((incident) => (
									<IncidentCard
										key={incident.id}
										incident={incident as any}
										isExpanded={true}
										detailsLink={(incident as any).detailsLink}
										onToggle={undefined}
									/>
								))}
							</div>
						</section>
					)}

					{/* Previous Incidents */}
					<section
						className="animate-slide-up"
						style={{ animationDelay: "0.2s" }}
					>
						<h2 className="mb-6 font-bold text-2xl text-foreground">
							Previous incidents
						</h2>

						<div className="space-y-8">
							{Object.keys(incidentsByDate).length === 0 ? (
								<p className="text-muted-foreground">No previous incidents.</p>
							) : (
								Object.entries(incidentsByDate).map(([date, incidents]) => (
									<div key={date}>
										<div className="mb-4 border-border border-b pb-2 font-medium text-muted-foreground text-sm">
											{date}
										</div>
										<div className="space-y-4">
											{incidents.map((incident) => (
												<IncidentCard
													key={incident.id}
													incident={incident}
													isExpanded={false}
													detailsLink={(incident as any).detailsLink}
													className="border-none bg-card/50 shadow-none hover:bg-card/80"
												/>
											))}
										</div>
									</div>
								))
							)}
						</div>

						<Link href={"/updates" as any}>
							<div className="mt-8 cursor-pointer rounded-lg bg-card/50 p-4 text-center transition-colors hover:bg-card/80">
								<span className="flex items-center justify-center gap-2 font-medium text-muted-foreground text-sm">
									Previous updates
									{/** biome-ignore lint/a11y/noSvgWithoutTitle: This SVG is used as an arrow icon to indicate a link to previous updates. It is not intended to be a keyboard-navigable or actionable interactive control, so adding roles like `button` or `link` or `tabIndex` would be semantically incorrect and misleading for assistive technologies. */}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
										className="lucide lucide-arrow-down-circle"
									>
										<circle cx="12" cy="12" r="10" />
										<path d="M8 12l4 4 4-4" />
										<path d="M12 8v8" />
									</svg>
								</span>
							</div>
						</Link>
					</section>
				</div>
			</main>

			<Footer />
		</div>
	);
}
