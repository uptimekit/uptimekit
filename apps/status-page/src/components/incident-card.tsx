import { ChevronDown, ChevronUp, Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { StatusDot, type StatusType } from "./status-indicator";

// We need to match the shape coming from db-queries
// Since we don't have strict shared types exported for the query result easily available without type generation build step running,
// we'll define a compatible interface or use 'any' if we must, but let's try to match schema.

interface IncidentActivity {
	id: string;
	message: string;
	createdAt: Date;
	type: string;
}

interface IncidentMonitor {
	monitor: {
		name: string;
	};
}

interface Incident {
	id: string;
	title: string;
	status: string; // 'investigating', 'identified', 'monitoring', 'resolved'
	severity: string; // 'minor', 'major', 'critical'
	activities: IncidentActivity[];
	monitors: IncidentMonitor[];
	createdAt: Date;
	resolvedAt?: Date | null;
}

interface IncidentCardProps {
	incident: Incident;
	isExpanded?: boolean;
	onToggle?: () => void;
	detailsLink?: string;
	className?: string;
}

// Map severity to StatusDot type
function getSeverityStatus(severity: string): StatusType {
	switch (severity) {
		case "critical":
			return "major_outage";
		case "major":
			return "partial_outage";
		case "minor":
			return "degraded";
		case "maintenance":
			return "maintenance";
		default:
			return "unknown"; // or 'operational' if resolved?
	}
}

export function IncidentCard({
	incident,
	isExpanded = false,
	onToggle,
	detailsLink,
	className,
}: IncidentCardProps) {
	return (
		<div
			className={cn(
				"overflow-hidden rounded-xl border border-border bg-card transition-all duration-300",
				"hover:border-primary/20",
				className,
			)}
		>
			<div className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-muted/50">
				<div className="flex items-center gap-3">
					<StatusDot status={getSeverityStatus(incident.severity)} />
					<div>
						<h3 className="font-semibold text-card-foreground">
							{incident.title}
						</h3>
						<p className="mt-0.5 text-muted-foreground text-xs">
							{new Date(incident.createdAt).toLocaleDateString("en-US", {
								month: "short",
								day: "numeric",
								year: "numeric",
							})}
							{incident.resolvedAt && " — Resolved"}
						</p>
					</div>
				</div>

				{detailsLink ? (
					<Link
						href={detailsLink as any}
						className="rounded-full p-2 transition-colors hover:bg-muted"
					>
						<ChevronDown className="-rotate-90 h-5 w-5 text-muted-foreground" />
					</Link>
				) : (
					<button
						type="button"
						onClick={onToggle}
						className="rounded-full p-2 transition-colors hover:bg-muted"
					>
						{isExpanded ? (
							<ChevronUp className="h-5 w-5 text-muted-foreground" />
						) : (
							<ChevronDown className="h-5 w-5 text-muted-foreground" />
						)}
					</button>
				)}
			</div>

			{isExpanded && !detailsLink && (
				<div className="animate-slide-up border-border border-t px-5 pt-4 pb-5">
					{/* Affected services */}
					{incident.monitors && incident.monitors.length > 0 && (
						<div className="mb-4">
							<h4 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
								Affected Services
							</h4>
							<div className="flex flex-wrap gap-2">
								{incident.monitors.map((m) => (
									<span
										key={m.monitor.name}
										className="inline-flex items-center rounded-md bg-secondary px-2.5 py-1 font-medium text-secondary-foreground text-xs"
									>
										{m.monitor.name}
									</span>
								))}
							</div>
						</div>
					)}

					{/* Updates timeline */}
					{incident.activities && incident.activities.length > 0 && (
						<div>
							<h4 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
								Updates
							</h4>
							<div className="">
								{incident.activities.map((activity, index) => (
									<div
										key={activity.id}
										className="relative pb-6 pl-6 last:pb-0"
									>
										{/* Timeline line */}
										{incident.activities.length > 1 && (
											<div
												className="absolute left-[7px] w-px bg-border"
												style={{
													top: index === 0 ? "13px" : "0",
													bottom:
														index === incident.activities.length - 1
															? "auto"
															: "0",
													height:
														index === incident.activities.length - 1
															? "13px"
															: "auto",
												}}
											/>
										)}
										{/* Timeline dot */}
										<div
											className={cn(
												"absolute top-1.5 left-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-card-foreground",
												// Since activity doesn't store status, we use a neutral dot or maybe based on incident status?
												// Let's use neutral for generic comments/activities
												"bg-muted-foreground/30",
											)}
										/>
										<div>
											<div className="mb-1 flex items-center gap-2">
												{/* 
                                                    If activity had a 'status' field we'd label it. 
                                                    For now just showing timestamp. 
                                                */}
												<span className="text-muted-foreground text-xs">
													{new Date(activity.createdAt).toLocaleString(
														"en-US",
														{
															month: "short",
															day: "numeric",
															hour: "numeric",
															minute: "2-digit",
															timeZone: "UTC", // Or user local? Next.js server side uses UTC by default commonly
														},
													)}
												</span>
											</div>
											<p className="text-card-foreground text-sm">
												{activity.message}
											</p>
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
