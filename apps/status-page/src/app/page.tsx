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
import { checkStatusPageAccess } from "@/lib/access-check";
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

const STATUS_PAGE_DOMAIN = process.env.NEXT_PUBLIC_STATUS_PAGE_DOMAIN;

function isStatusPageDomain(host: string): boolean {
	if (!STATUS_PAGE_DOMAIN) return false;
	const domain = host.split(":")[0];
	return domain === STATUS_PAGE_DOMAIN;
}

// Helper to calculate status based on stats
// Automatycznie mamy tylko statusy operational i outage.
function calculateDailyStatus(total: number, up: number): StatusType {
	if (total === 0) return "unknown";
	const ratio = up / total;
	if (ratio < 1) return "major_outage";
	return "operational";
}

function fillMissingDays(
	stats: {
		date: string;
		total_checks: number;
		up_checks: number;
	}[],
	days = 90,
	endDate?: string,
	intervalSeconds = 60,
): UptimeDay[] {
	const result: UptimeDay[] = [];
	let now: Date;
	if (endDate) {
		now = new Date(endDate);
	} else {
		const today = new Date();
		now = new Date(
			Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
		);
	}

	const statsMap = new Map(stats.map((s) => [s.date, s]));

	for (let i = days - 1; i >= 0; i--) {
		const d = new Date(now);
		d.setDate(d.getDate() - i);
		const dateStr = d.toISOString().split("T")[0];
		const stat = statsMap.get(dateStr);

		if (stat) {
			const uptime =
				stat.total_checks > 0 ? (stat.up_checks / stat.total_checks) * 100 : 0;
			// Calculate downtime in milliseconds based on failed checks
			const failedChecks = stat.total_checks - stat.up_checks;
			const downtimeMs = failedChecks * intervalSeconds * 1000;
			result.push({
				date: dateStr,
				status: calculateDailyStatus(stat.total_checks, stat.up_checks),
				uptime: uptime,
				downtimeMs: downtimeMs,
			});
		} else {
			result.push({
				date: dateStr,
				status: "unknown",
				uptime: 0,
				downtimeMs: 0,
			});
		}
	}
	return result;
}

export async function generateMetadata() {
	const headersList = await headers();
	const host =
		headersList.get("x-forwarded-host") ||
		headersList.get("x-original-host") ||
		headersList.get("host");
	const protocol = headersList.get("x-forwarded-proto") || "https";

	if (!host) {
		return {};
	}

	// If accessing the status page domain root, show landing metadata
	if (isStatusPageDomain(host)) {
		return {
			title: "Status Pages - UptimeKit",
			description: "Monitor and share service status with your users.",
		};
	}

	const domain = host.split(":")[0];
	const pageConfig = await getStatusPageByDomain(domain);

	const title = pageConfig?.name ? `${pageConfig.name} Status` : "Status Page";
	const description = pageConfig?.name
		? `Real-time status and incident history for ${pageConfig.name}. Check system availability and past incidents.`
		: "Real-time system status and incident history.";

	const design = (pageConfig?.design as any) || {};
	const logoUrl = design.logoUrl;

	return {
		title,
		description,
		applicationName: pageConfig?.name || "Status Page",
		icons:
			design.faviconUrl || logoUrl
				? { icon: design.faviconUrl || logoUrl }
				: undefined,
		openGraph: {
			title,
			description,
			siteName: title,
			images: [
				{
					url: `${protocol}://${host}/api/og`,
					width: 1200,
					height: 630,
					alt: title,
				},
			],
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
			images: [`${protocol}://${host}/api/og`],
		},
		robots: {
			index: true,
			follow: true,
		},
	};
}

function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (hours > 0) {
		return `${hours}h ${minutes % 60}m`;
	}
	if (minutes > 0) {
		return `${minutes}m`;
	}
	return `${seconds}s`;
}

function LandingPage() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background font-sans text-foreground">
			<div className="mx-auto max-w-2xl px-4 text-center">
				<h1 className="mb-4 font-bold text-4xl tracking-tight">Status Pages</h1>
				<p className="mb-8 text-lg text-muted-foreground">
					This is the status page domain. To view a specific status page, add
					the page slug to the URL.
				</p>
				<p className="text-muted-foreground text-sm">
					Example: {STATUS_PAGE_DOMAIN || "status.example.com"}/your-page-slug
				</p>
			</div>
		</div>
	);
}

export default async function StatusPage() {
	const headersList = await headers();
	const host =
		headersList.get("x-forwarded-host") ||
		headersList.get("x-original-host") ||
		headersList.get("host");

	if (!host) {
		notFound();
	}

	// If accessing the status page domain root, show landing page
	if (isStatusPageDomain(host)) {
		return <LandingPage />;
	}

	// Remove port if present for local dev match mostly, but production might strictly match
	const domain = host.split(":")[0];

	const pageConfig = await getStatusPageByDomain(domain);

	if (!pageConfig) {
		notFound();
	}

	// Check access for private pages
	await checkStatusPageAccess(pageConfig, "/");

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

	// 1. Fetch hourly stats to allow local timezone aggregation
	const monitorsWithStats = await Promise.all(
		pageConfig.monitors.map(async (pm) => {
			const hourlyStats = await getMonitorUptime(pm.monitorId);
			return { pm, hourlyStats };
		}),
	);

	// 2. Aggregate hourly stats into daily stats based on LOCAL time
	const monitorsData = await Promise.all(
		monitorsWithStats.map(async ({ pm, hourlyStats }) => {
			const dailyStatsMap = new Map<
				string,
				{ date: string; total_checks: number; up_checks: number }
			>();

			for (const stat of hourlyStats) {
				// stat.date_hour is "YYYY-MM-DD HH" (UTC implied from DB storage usually)
				// We append ":00:00Z" to parse it as UTC, replacing space with T for valid ISO format
				const dateObj = new Date(`${stat.date_hour.replace(" ", "T")}:00:00Z`);

				// Get UTC YYYY-MM-DD to avoid server timezone offsets
				const year = dateObj.getUTCFullYear();
				const month = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
				const day = String(dateObj.getUTCDate()).padStart(2, "0");
				const localDateStr = `${year}-${month}-${day}`;

				if (!dailyStatsMap.has(localDateStr)) {
					dailyStatsMap.set(localDateStr, {
						date: localDateStr,
						total_checks: 0,
						up_checks: 0,
					});
				}

				const daily = dailyStatsMap.get(localDateStr)!;
				daily.total_checks += Number(stat.total_checks);
				daily.up_checks += Number(stat.up_checks);
			}

			const dailyStats = Array.from(dailyStatsMap.values()).sort((a, b) =>
				b.date.localeCompare(a.date),
			);

			// 1. Calculate Live Status
			// Only "operational", "major_outage" (as outage), or "maintenance".
			let currentStatus: StatusType = "operational";

			// Check active maintenance
			const isUnderMaintenance = activeMaintenances.some((m) =>
				m.monitors.some((mm) => mm.monitorId === pm.monitorId),
			);
			if (isUnderMaintenance) {
				currentStatus = "maintenance" as any;
			}

			// Check active incidents (overrides maintenance if concurrent? usually yes)
			// User: "Automatycznie mamy tylko statusy operational i outage"
			// If active report exists -> outage.
			const activeReport = activeReports.find((r: any) =>
				r.affectedMonitors.some((am: any) => am.monitorId === pm.monitorId),
			);

			if (activeReport) {
				// Map severity to status
				switch (activeReport.severity) {
					case "minor":
					case "degraded":
						currentStatus = "degraded";
						break;
					case "major":
						currentStatus = "partial_outage";
						break;
					case "critical":
						currentStatus = "major_outage";
						break;
					default:
						currentStatus = "major_outage";
				}
			}

			// Check automated heartbeat status if no manual incident is active
			if (currentStatus === "operational") {
				const lastCheck = await getMonitorStatus(pm.monitorId);
				if (lastCheck) {
					// Logic: down -> outage. degraded -> check user intent?
					// "Nie nadajemy recznie statusow major outage lub minor outage"
					// + "Automatycznie mamy tylko statusy operational i outage"
					if (lastCheck.status === "down") currentStatus = "major_outage";
				}
			}

			// Fill missing days using the LOCAL today as anchor (implicit in fillMissingDays default now)
			// limiting to 90 days.
			// We don't need to force startDate anymore because dailyStats now contains "Today" (local) if data exists.
			// However, ensuring alignment: fillMissingDays defaults 'now' to Local Today via new Date().
			// Pass the monitor's interval to calculate accurate downtime
			const monitorInterval = pm.monitor.interval || 60; // Default 60 seconds
			const incidentPendingDuration = pm.monitor.incidentPendingDuration || 0; // In seconds
			const incidentThresholdMs = incidentPendingDuration * 1000;

			let history = fillMissingDays(dailyStats, 90, undefined, monitorInterval);

			// Filter out short downtimes that don't exceed the incident threshold
			// This respects the monitor's setting - if a monitor requires 3 minutes of failure
			// to trigger an incident, we shouldn't show single-check failures as downtime
			history = history.map((day) => ({
				...day,
				downtimeMs:
					(day.downtimeMs || 0) > incidentThresholdMs ? day.downtimeMs : 0,
			}));

			// Overlay Manual Events (Maintenance & Incidents)
			history = history.map((day) => {
				const dayDate = new Date(day.date);
				dayDate.setHours(12, 0, 0, 0); // Noon to safely check date

				// Date boundaries for the day (00:00:00 to 23:59:59)
				const dayStart = new Date(day.date);
				dayStart.setHours(0, 0, 0, 0);
				const dayEnd = new Date(day.date);
				dayEnd.setHours(23, 59, 59, 999);

				// Check Maintenance (Priority 1)
				const maintenance = events.maintenances.find((m) => {
					const affectsMonitor = m.monitors.some(
						(mm) => mm.monitorId === pm.monitorId,
					);
					if (!affectsMonitor) return false;

					const start = new Date(m.startAt);
					const end = m.endAt ? new Date(m.endAt) : new Date();

					// Check overlap
					return start <= dayEnd && end >= dayStart;
				});

				if (maintenance) {
					// Maintenance overrides everything.
					return {
						...day,
						status: "maintenance" as any,
						uptime: 100,
						duration: undefined,
					};
				}

				// Check Incidents (Reports) (Priority 2, overrides automated checks)
				const relevantReports = events.reports.filter((r) => {
					const affectsMonitor = r.affectedMonitors.some(
						(am) => am.monitorId === pm.monitorId,
					);
					if (!affectsMonitor) return false;

					const start = new Date(r.createdAt);
					const end = r.resolvedAt ? new Date(r.resolvedAt) : new Date();

					// Check overlap
					return start <= dayEnd && end >= dayStart;
				});

				if (relevantReports.length > 0) {
					// Calculate incident duration for this day
					let totalDurationMs = 0;

					for (const r of relevantReports) {
						const start = new Date(r.createdAt);
						const end = r.resolvedAt ? new Date(r.resolvedAt) : new Date();

						// Intersection of [start, end] and [dayStart, dayEnd]
						const overlapStart = start > dayStart ? start : dayStart;
						const overlapEnd = end < dayEnd ? end : dayEnd;

						if (overlapEnd > overlapStart) {
							totalDurationMs += overlapEnd.getTime() - overlapStart.getTime();
						}
					}

					// Recalculate uptime percentage based on duration
					// Total ms in a day = 24 * 60 * 60 * 1000 = 86400000
					const totalDayMs = 86400000;
					// Capped at 100% loss
					const lossRatio = Math.min(totalDurationMs / totalDayMs, 1);
					const newUptime = (1 - lossRatio) * 100;

					// Determine worst severity for the day
					let worstSeverityStatus: StatusType = "operational";
					// Priority: critical (major_outage) > major (partial_outage) > minor/degraded (degraded)

					for (const r of relevantReports) {
						let currentStatusForReport: StatusType = "operational";
						if (r.severity === "critical")
							currentStatusForReport = "major_outage";
						else if (r.severity === "major")
							currentStatusForReport = "partial_outage";
						else if (r.severity === "minor" || r.severity === "degraded")
							currentStatusForReport = "degraded";
						else currentStatusForReport = "major_outage"; // fallback

						// Promote if worse
						if (worstSeverityStatus === "operational")
							worstSeverityStatus = currentStatusForReport;
						else if (
							worstSeverityStatus === "degraded" &&
							(currentStatusForReport === "partial_outage" ||
								currentStatusForReport === "major_outage")
						)
							worstSeverityStatus = currentStatusForReport;
						else if (
							worstSeverityStatus === "partial_outage" &&
							currentStatusForReport === "major_outage"
						)
							worstSeverityStatus = currentStatusForReport;
					}

					return {
						...day,
						status: worstSeverityStatus,
						uptime: newUptime,
						duration: formatDuration(totalDurationMs),
					};
				}

				// Priority 3: Automatic Status (from checks)
				// calculateDailyStatus already filtered this to operational/major_outage
				return day;
			});

			const knownDays = history.filter(
				(d) => d.status !== "unknown" && d.status !== "maintenance",
			);

			// Calculate average uptime for the period (for display next to monitor name)
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
				displayStyle: pm.style || "history", // 'history' or 'status'
				description: pm.description,
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
	// Priority: maintenance (highest) > manual status updates (major_outage, partial_outage, degraded) > operational (automated)
	const worstStatus = monitorsData.reduce((acc, curr) => {
		// Maintenance has highest priority - always show if any service is under maintenance
		if (curr.currentStatus === "maintenance" || acc === "maintenance") {
			return "maintenance";
		}

		// Major outage (manual incident) is second priority
		if (curr.currentStatus === "major_outage" || acc === "major_outage") {
			return "major_outage";
		}

		// Partial outage (manual incident) is third priority
		if (curr.currentStatus === "partial_outage" || acc === "partial_outage") {
			return "partial_outage";
		}

		// Degraded (manual incident) is fourth priority
		if (curr.currentStatus === "degraded" || acc === "degraded") {
			return "degraded";
		}

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
											displayStyle={monitor.displayStyle as any}
											description={monitor.description}
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
