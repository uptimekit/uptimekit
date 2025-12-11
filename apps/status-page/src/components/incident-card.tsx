import { cn } from "@/lib/utils";
import { StatusDot, type StatusType } from "./status-indicator";
import { ChevronDown, ChevronUp } from "lucide-react";

interface IncidentUpdate {
	id: string;
	status: "investigating" | "identified" | "monitoring" | "resolved";
	message: string;
	timestamp: Date;
}

interface Incident {
	id: string;
	title: string;
	status: StatusType;
	updates: IncidentUpdate[];
	affectedServices: string[];
	startedAt: Date;
	resolvedAt?: Date;
}

interface IncidentCardProps {
	incident: Incident;
	isExpanded?: boolean;
	onToggle?: () => void;
	className?: string;
}

const updateStatusColors: Record<IncidentUpdate["status"], string> = {
	investigating: "text-status-major-outage",
	identified: "text-status-partial-outage",
	monitoring: "text-status-degraded",
	resolved: "text-status-operational",
};

export function IncidentCard({
	incident,
	isExpanded = false,
	onToggle,
	className,
}: IncidentCardProps) {
	return (
		<div
			className={cn(
				"rounded-xl border border-border bg-card overflow-hidden transition-all duration-300",
				"hover:border-primary/20",
				className
			)}
		>
			<button
				type="button"
				onClick={onToggle}
				className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/50 transition-colors"
			>
				<div className="flex items-center gap-3">
					<StatusDot status={incident.status} />
					<div>
						<h3 className="font-semibold text-card-foreground">
							{incident.title}
						</h3>
						<p className="text-xs text-muted-foreground mt-0.5">
							{incident.startedAt.toLocaleDateString("en-US", {
								month: "short",
								day: "numeric",
								year: "numeric",
							})}
							{incident.resolvedAt && " — Resolved"}
						</p>
					</div>
				</div>
				{isExpanded ? (
					<ChevronUp className="h-5 w-5 text-muted-foreground" />
				) : (
					<ChevronDown className="h-5 w-5 text-muted-foreground" />
				)}
			</button>

			{isExpanded && (
				<div className="px-5 pb-5 border-t border-border pt-4 animate-slide-up">
					{/* Affected services */}
					<div className="mb-4">
						<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
							Affected Services
						</h4>
						<div className="flex flex-wrap gap-2">
							{incident.affectedServices.map((service) => (
								<span
									key={service}
									className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground"
								>
									{service}
								</span>
							))}
						</div>
					</div>

					{/* Updates timeline */}
					<div>
						<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
							Updates
						</h4>
						<div className="space-y-4">
							{incident.updates.map((update, index) => (
								<div key={update.id} className="relative pl-6">
									{/* Timeline line */}
									{index < incident.updates.length - 1 && (
										<div className="absolute left-[7px] top-4 bottom-0 w-px bg-border" />
									)}
									{/* Timeline dot */}
									<div
										className={cn(
											"absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background",
											update.status === "resolved"
												? "bg-status-operational"
												: update.status === "monitoring"
													? "bg-status-degraded"
													: update.status === "identified"
														? "bg-status-partial-outage"
														: "bg-status-major-outage"
										)}
									/>
									<div>
										<div className="flex items-center gap-2 mb-1">
											<span
												className={cn(
													"text-xs font-semibold uppercase",
													updateStatusColors[update.status]
												)}
											>
												{update.status}
											</span>
											<span className="text-xs text-muted-foreground">
												{update.timestamp.toLocaleString("en-US", {
													month: "short",
													day: "numeric",
													hour: "numeric",
													minute: "2-digit",
												})}
											</span>
										</div>
										<p className="text-sm text-card-foreground">
											{update.message}
										</p>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export function generateMockIncidents(): Incident[] {
	const now = new Date();

	return [
		{
			id: "1",
			title: "API Response Time Degradation",
			status: "degraded",
			affectedServices: ["API Gateway", "Authentication Service"],
			startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
			updates: [
				{
					id: "1-3",
					status: "monitoring",
					message: "We have deployed a fix and are monitoring the situation. Response times are improving.",
					timestamp: new Date(now.getTime() - 30 * 60 * 1000),
				},
				{
					id: "1-2",
					status: "identified",
					message: "The issue has been identified as a database connection pool exhaustion. We are working on a fix.",
					timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000),
				},
				{
					id: "1-1",
					status: "investigating",
					message: "We are investigating reports of increased API response times.",
					timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
				},
			],
		},
		{
			id: "2",
			title: "Scheduled Database Maintenance",
			status: "maintenance",
			affectedServices: ["Database", "Data Processing"],
			startedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
			resolvedAt: new Date(now.getTime() - 20 * 60 * 60 * 1000),
			updates: [
				{
					id: "2-2",
					status: "resolved",
					message: "Maintenance completed successfully. All systems are back to normal.",
					timestamp: new Date(now.getTime() - 20 * 60 * 60 * 1000),
				},
				{
					id: "2-1",
					status: "investigating",
					message: "Starting scheduled database maintenance. Some services may experience brief interruptions.",
					timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000),
				},
			],
		},
	];
}
