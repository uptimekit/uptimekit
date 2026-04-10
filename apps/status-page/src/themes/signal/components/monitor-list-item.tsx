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
	description?: string | null;
	className?: string;
	barStyle?: "normal" | "length" | "signal";
}

export function MonitorListItem({
	name,
	status,
	uptimePercentage,
	history,
	displayStyle = "history",
	description,
	className,
	barStyle = "normal",
}: MonitorListItemProps) {
	return (
		<div className={cn("space-y-3", className)}>
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 items-center gap-2.5">
						<StatusDot status={status} className="mt-1 shrink-0" />
						<div className="min-w-0 flex-1">
							<div className="flex min-w-0 items-center gap-2">
								<h3 className="truncate font-medium text-[14px] text-foreground sm:text-[15px]">
									{name}
								</h3>
								{description ? (
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
											<Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
										</TooltipTrigger>
										<TooltipContent>
											<p className="max-w-xs text-sm">{description}</p>
										</TooltipContent>
									</Tooltip>
								) : null}
							</div>
						</div>
					</div>
				</div>

				<div className="shrink-0 text-right">
					<div
						className={cn(
							"font-medium text-[13px]",
							statusConfig[status].color,
						)}
					>
						{displayStyle === "status"
							? statusConfig[status].label
							: `${uptimePercentage.toFixed(2)}% uptime`}
					</div>
				</div>
			</div>

			{displayStyle === "history" ? (
				<UptimeBar days={history} style={barStyle} />
			) : (
				<div className="text-[13px] text-muted-foreground">
					Current state: {statusConfig[status].label}
				</div>
			)}
		</div>
	);
}
