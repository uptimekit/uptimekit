import { cn } from "@/lib/utils";
import { StatusDot, type StatusType } from "./status-indicator";
import type { UptimeDay } from "./uptime-bar";
import { UptimeBar } from "./uptime-bar";

interface MonitorListItemProps {
	name: string;
	status: StatusType;
	uptimePercentage: number;
	history: UptimeDay[];
	className?: string;
}

export function MonitorListItem({
	name,
	status,
	uptimePercentage,
	history,
	className,
}: MonitorListItemProps) {
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
					{uptimePercentage.toFixed(3)}% uptime
				</div>
			</div>

			<UptimeBar days={history} />
		</div>
	);
}
