import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot, type StatusType } from "./status-indicator";

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
				"overflow-hidden rounded-xl border border-border bg-card transition-all duration-300",
				"hover:border-primary/20",
				className,
			)}
		>
			<button
				type="button"
				onClick={onToggle}
				className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-muted/50"
			>
				<div className="flex items-center gap-3">
					<StatusDot status={incident.status} />
					<div>
						<h3 className="font-semibold text-card-foreground">
							{incident.title}
						</h3>
						<p className="mt-0.5 text-muted-foreground text-xs">
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
				<div className="animate-slide-up border-border border-t px-5 pt-4 pb-5">
					{/* Affected services */}
					<div className="mb-4">
						<h4 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
							Affected Services
						</h4>
						<div className="flex flex-wrap gap-2">
							{incident.affectedServices.map((service) => (
								<span
									key={service}
									className="inline-flex items-center rounded-md bg-secondary px-2.5 py-1 font-medium text-secondary-foreground text-xs"
								>
									{service}
								</span>
							))}
						</div>
					</div>

					{/* Updates timeline */}
					<div>
						<h4 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
							Updates
						</h4>
						<div className="space-y-4">
							{incident.updates.map((update, index) => (
								<div key={update.id} className="relative pl-6">
									{/* Timeline line */}
									{index < incident.updates.length - 1 && (
										<div className="absolute top-4 bottom-0 left-[7px] w-px bg-border" />
									)}
									{/* Timeline dot */}
									<div
										className={cn(
											"absolute top-1.5 left-0 h-3.5 w-3.5 rounded-full border-2 border-background",
											update.status === "resolved"
												? "bg-status-operational"
												: update.status === "monitoring"
													? "bg-status-degraded"
													: update.status === "identified"
														? "bg-status-partial-outage"
														: "bg-status-major-outage",
										)}
									/>
									<div>
										<div className="mb-1 flex items-center gap-2">
											<span
												className={cn(
													"font-semibold text-xs uppercase",
													updateStatusColors[update.status],
												)}
											>
												{update.status}
											</span>
											<span className="text-muted-foreground text-xs">
												{update.timestamp.toLocaleString("en-US", {
													month: "short",
													day: "numeric",
													hour: "numeric",
													minute: "2-digit",
												})}
											</span>
										</div>
										<p className="text-card-foreground text-sm">
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
					message:
						"We have deployed a fix and are monitoring the situation. Response times are improving.",
					timestamp: new Date(now.getTime() - 30 * 60 * 1000),
				},
				{
					id: "1-2",
					status: "identified",
					message:
						"The issue has been identified as a database connection pool exhaustion. We are working on a fix.",
					timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000),
				},
				{
					id: "1-1",
					status: "investigating",
					message:
						"We are investigating reports of increased API response times.",
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
					message:
						"Maintenance completed successfully. All systems are back to normal.",
					timestamp: new Date(now.getTime() - 20 * 60 * 60 * 1000),
				},
				{
					id: "2-1",
					status: "investigating",
					message:
						"Starting scheduled database maintenance. Some services may experience brief interruptions.",
					timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000),
				},
			],
		},
	];
}
