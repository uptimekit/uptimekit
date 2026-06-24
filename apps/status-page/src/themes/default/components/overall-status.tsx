import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type {
	GroupedMonitors,
	Incident,
	Monitor,
	StatusType,
} from "../../types";
import { StatusIndicator } from "./status-indicator";

interface OverallStatusProps {
	status: StatusType;
	monitorGroups?: GroupedMonitors[];
	activeIssues?: Incident[];
	className?: string;
}

const issueStatuses = new Set<StatusType>([
	"degraded",
	"partial_outage",
	"major_outage",
]);

function getAffectedMonitors(monitorGroups: GroupedMonitors[] = []): Monitor[] {
	return monitorGroups
		.flatMap(({ monitors }) => monitors)
		.filter((monitor) => issueStatuses.has(monitor.currentStatus));
}

function getActiveIncidents(activeIssues: Incident[] = []): Incident[] {
	return activeIssues.filter((issue) => issue.severity !== "maintenance");
}

function getRelatedIncidents(
	monitor: Monitor,
	activeIncidents: Incident[],
): Incident[] {
	return activeIncidents.filter((incident) =>
		incident.monitors.some(({ monitor: item }) => item.id === monitor.id),
	);
}

const statusMessages: Record<
	StatusType,
	{ title: string; description: string }
> = {
	operational: {
		title: "All Systems Operational",
		description: "All services are running smoothly with no reported issues.",
	},
	degraded: {
		title: "Degraded Performance",
		description:
			"Some services are experiencing slower than usual response times.",
	},
	partial_outage: {
		title: "Partial System Outage",
		description:
			"Some services are currently unavailable. We are investigating.",
	},
	major_outage: {
		title: "Major System Outage",
		description:
			"Multiple services are experiencing issues. Our team is working on it.",
	},
	maintenance: {
		title: "Under Maintenance",
		description:
			"System is undergoing planned maintenance. Services may be temporarily unavailable.",
	},
	maintenance_scheduled: {
		title: "Maintenance Scheduled",
		description: "Upcoming maintenance is scheduled.",
	},
	maintenance_completed: {
		title: "Maintenance Completed",
		description: "Planned maintenance has been completed.",
	},
	unknown: {
		title: "Status Unknown",
		description: "We are currently unable to determine the system status.",
	},
};

const statusGradients: Record<StatusType, string> = {
	operational:
		"from-status-operational/10 via-status-operational/5 to-transparent",
	degraded: "from-status-degraded/10 via-status-degraded/5 to-transparent",
	partial_outage:
		"from-status-partial-outage/10 via-status-partial-outage/5 to-transparent",
	major_outage:
		"from-status-major-outage/10 via-status-major-outage/5 to-transparent",
	maintenance:
		"from-status-maintenance/10 via-status-maintenance/5 to-transparent",
	maintenance_scheduled:
		"from-status-partial-outage/10 via-status-partial-outage/5 to-transparent",
	maintenance_completed:
		"from-status-operational/10 via-status-operational/5 to-transparent",
	unknown: "from-status-unknown/10 via-status-unknown/5 to-transparent",
};

export function OverallStatus({
	status,
	monitorGroups,
	activeIssues,
	className,
}: OverallStatusProps) {
	// Custom simplified messages for the compact view
	const title =
		status === "operational"
			? "All services are online"
			: status === "maintenance"
				? "Ongoing Maintenance"
				: statusMessages[status].title;

	const affectedMonitors = getAffectedMonitors(monitorGroups);
	const activeIncidents = getActiveIncidents(activeIssues);
	const shouldShowIssueDetails =
		issueStatuses.has(status) &&
		(affectedMonitors.length > 0 || activeIncidents.length > 0);

	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm",
				className,
			)}
		>
			<div
				className={cn(
					"absolute inset-0 bg-gradient-to-r opacity-20",
					statusGradients[status],
				)}
			/>

			<div className="relative z-10">
				<div className="flex items-center gap-3">
					<StatusIndicator status={status} size="md" showLabel={false} />
					<h1 className="font-semibold text-card-foreground text-lg">
						{title}
					</h1>
				</div>

				{shouldShowIssueDetails ? (
					<div className="mt-4 border-border/70 border-t pt-3">
						<p className="text-muted-foreground text-sm">Affected monitors:</p>
						{affectedMonitors.length > 0 ? (
							<ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
								{affectedMonitors.map((monitor) => {
									const relatedIncidents = getRelatedIncidents(
										monitor,
										activeIncidents,
									);

									return (
										<li key={monitor.id}>
											<span className="font-medium text-card-foreground">
												{monitor.name}
											</span>
											{" - "}
											{relatedIncidents.length > 0
												? relatedIncidents.map((incident, index) => (
														<span key={incident.id}>
															{index > 0 ? ", " : ""}
															<Link
																href={incident.detailsLink as Route}
																className="text-card-foreground underline underline-offset-2 hover:text-primary"
															>
																{incident.title}
															</Link>
														</span>
													))
												: "no linked incident"}
										</li>
									);
								})}
							</ul>
						) : (
							<ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
								{activeIncidents.map((incident) => (
									<li key={incident.id}>
										<Link
											href={incident.detailsLink as Route}
											className="text-card-foreground underline underline-offset-2 hover:text-primary"
										>
											{incident.title}
										</Link>
									</li>
								))}
							</ul>
						)}
					</div>
				) : null}
			</div>
		</div>
	);
}
