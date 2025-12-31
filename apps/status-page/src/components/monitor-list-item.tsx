import { cn } from "@/lib/utils";
import { StatusDot, type StatusType, statusConfig } from "./status-indicator";
import type { UptimeDay } from "./uptime-bar";
import { UptimeBar } from "./uptime-bar";

interface MonitorListItemProps {
	name: string;
	status: StatusType;
	uptimePercentage: number;
	history: UptimeDay[];
	displayStyle?: "history" | "status";
	className?: string;
}

export function MonitorListItem({
	name,
	status,
	uptimePercentage,
	history,
	displayStyle = "history",
	className,
}: MonitorListItemProps) {
	// Status-only mode: show only name and current status
	if (displayStyle === "status") {
		return (
			<div className={cn("group py-4 first:pt-0 last:pb-0", className)}>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<StatusDot status={status} />
						<h3 className="font-semibold text-foreground text-lg">{name}</h3>
					</div>
					<div
						className={cn(
							"font-medium text-sm",
							status === "operational"
								? "text-status-operational"
								: status === "maintenance"
									? "text-status-maintenance"
									: "text-status-major-outage",
						)}
					>
						{statusConfig[status].label}
					</div>
				</div>
			</div>
		);
	}

	// History mode: show full uptime bar with history
	return (
		<div className={cn("group py-6 first:pt-0 last:pb-0", className)}>
			<div className="mb-3 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<StatusDot status={status} />
					<h3 className="font-semibold text-foreground text-lg">{name}</h3>
				</div>
				<div
					className={cn(
						"font-medium text-sm",
						status === "operational"
							? "text-status-operational"
							: "text-muted-foreground",
					)}
				>
					{uptimePercentage.toFixed(2)}% uptime
				</div>
			</div>

			<UptimeBar days={history} />
		</div>
	);
}
