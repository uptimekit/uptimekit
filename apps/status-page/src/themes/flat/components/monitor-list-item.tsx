import { Info } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { statusConfig } from "../../status-config";
import type { StatusType, UptimeDay } from "../../types";
import { StatusDot } from "./status-indicator";
import { UptimeBar } from "./uptime-bar";

interface MonitorListItemProps {
	name: string;
	status: StatusType;
	uptimePercentage: number;
	history: UptimeDay[];
	displayStyle?: "history" | "status";
	className?: string;
	description?: string | null;
	barStyle?: "normal" | "length" | "signal";
}

export function MonitorListItem({
	name,
	status,
	uptimePercentage,
	history,
	displayStyle = "history",
	className,
	description,
	barStyle = "normal",
}: MonitorListItemProps) {
	if (displayStyle === "status") {
		return (
			<div className={cn("group py-3 first:pt-0 last:pb-0", className)}>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2.5">
						<StatusDot status={status} />
						<h3 className="font-medium text-base text-foreground">{name}</h3>
						{description && (
							<Tooltip>
								<TooltipTrigger
									render={
										<button
											type="button"
											className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
											aria-label="More information"
										/>
									}
								>
									<Info className="h-3.5 w-3.5 text-muted-foreground/60" />
								</TooltipTrigger>
								<TooltipContent>
									<p className="max-w-xs text-sm">{description}</p>
								</TooltipContent>
							</Tooltip>
						)}
					</div>
					<div
						className={cn(
							"font-medium text-xs",
							statusConfig[status]?.color || "text-muted-foreground",
						)}
					>
						{statusConfig[status]?.label || status || "Unknown"}
					</div>
				</div>
			</div>
		);
	}

	// History mode: compact uptime bar view
	return (
		<div className={cn("group py-4 first:pt-0 last:pb-0", className)}>
			<div className="mb-2 flex items-center justify-between gap-4">
				<div className="flex min-w-0 flex-1 items-center gap-2.5">
					<StatusDot status={status} />
					<h3 className="truncate font-medium text-foreground text-sm">
						{name}
					</h3>
					{description && (
						<Tooltip>
							<TooltipTrigger
								render={
									<button
										type="button"
										className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
										aria-label="More information"
									/>
								}
							>
								<Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
							</TooltipTrigger>
							<TooltipContent>
								<p className="max-w-xs text-sm">{description}</p>
							</TooltipContent>
						</Tooltip>
					)}
				</div>
				<div
					className={cn(
						"shrink-0 font-semibold text-xs",
						statusConfig[status].color,
					)}
				>
					{uptimePercentage.toFixed(2)}%
				</div>
			</div>

			<UptimeBar days={history} style={barStyle} />
		</div>
	);
}
