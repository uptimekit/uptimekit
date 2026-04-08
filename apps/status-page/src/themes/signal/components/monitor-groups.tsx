"use client";

import { ChevronDown } from "lucide-react";
import { memo, useState } from "react";
import { calculateAggregateStatus } from "@/lib/status-utils";
import { cn } from "@/lib/utils";
import type { GroupedMonitors, StatusType } from "../../types";
import { MonitorListItem } from "./monitor-list-item";
import { StatusDot } from "./status-indicator";

interface MonitorGroupsProps {
	monitorGroups: GroupedMonitors[];
	layout?: "vertical" | "horizontal";
	barStyle?: "normal" | "length";
}

function getGroupStatusText(
	status: StatusType,
	totalMonitors: number,
	operationalCount: number,
): string {
	if (status === "operational") {
		return "Operational";
	}
	if (status === "major_outage") {
		return "Outage";
	}
	if (status === "maintenance_scheduled") {
		return "Scheduled maintenance";
	}
	if (status === "unknown") {
		return totalMonitors === 0 ? "No monitors" : "Unknown";
	}
	return `${operationalCount}/${totalMonitors} operational`;
}

const MonitorGroupItem = memo(
	({
		group,
		isDefaultExpanded,
		isGrid,
	}: {
		group: GroupedMonitors;
		isDefaultExpanded: boolean;
		isGrid: boolean;
	}) => {
		const isUngrouped = !group.group;
		const [isExpanded, setIsExpanded] = useState(isUngrouped || isDefaultExpanded);
		const groupStatus = calculateAggregateStatus(
			group.monitors.map((monitor) => monitor.currentStatus),
		);
		const operationalCount = group.monitors.filter(
			(monitor) => monitor.currentStatus === "operational",
		).length;

		return (
			<div className="signal-panel rounded-2xl border border-border">
				{group.group ? (
					<button
						type="button"
						onClick={() => setIsExpanded((current) => !current)}
						className={cn(
							"flex w-full items-center gap-3 px-4 py-4 text-left sm:px-5",
							isExpanded && "border-border/80 border-b",
						)}
					>
						<ChevronDown
							className={cn(
								"h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
								!isExpanded && "-rotate-90",
							)}
						/>
						<div className="min-w-0 flex-1">
							<div className="flex items-center justify-between gap-3">
								<span className="truncate font-medium text-[15px] text-foreground">
									{group.group.name}
								</span>
								<div className="flex items-center gap-2">
									<span className="hidden text-[12px] text-muted-foreground sm:inline">
										{getGroupStatusText(
											groupStatus,
											group.monitors.length,
											operationalCount,
										)}
									</span>
									<StatusDot status={groupStatus} />
								</div>
							</div>
						</div>
					</button>
				) : null}

				<div
					className={cn(
						"grid transition-all duration-200 ease-out",
						isExpanded
							? "grid-rows-[1fr] opacity-100"
							: "pointer-events-none grid-rows-[0fr] opacity-0",
					)}
				>
					<div
						className={cn(
							"min-h-0",
							isExpanded ? "overflow-visible" : "overflow-hidden",
						)}
					>
						<div
							className={cn(
								"px-4 py-4 sm:px-5 sm:py-5",
								isGrid ? "grid gap-4 md:grid-cols-2" : "space-y-4",
							)}
						>
							{group.monitors.map((monitor, index) => (
								<div
									key={monitor.id}
									className={cn(
										"pb-4 last:pb-0",
										!isGrid &&
											index !== group.monitors.length - 1 &&
											"border-border/70 border-b",
										isGrid && "rounded-xl border border-border/70 p-4 pb-4",
									)}
								>
									<MonitorListItem
										name={monitor.name}
										status={monitor.currentStatus}
										uptimePercentage={monitor.avgUptime}
										history={monitor.history}
										displayStyle={monitor.displayStyle}
										description={monitor.description}
									/>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		);
	},
);

MonitorGroupItem.displayName = "MonitorGroupItem";

export function MonitorGroups({
	monitorGroups,
	layout = "vertical",
}: MonitorGroupsProps) {
	const isGrid = layout === "horizontal";

	return (
		<section className="space-y-3">
			{monitorGroups.map((group, index) => (
				<MonitorGroupItem
					key={group.group?.id || `ungrouped-${index}`}
					group={group}
					isDefaultExpanded={index === 0}
					isGrid={isGrid}
				/>
			))}
		</section>
	);
}
