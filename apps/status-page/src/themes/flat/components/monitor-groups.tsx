"use client";

import { ChevronDown } from "lucide-react";
import { memo, useState } from "react";
import { cn } from "@/lib/utils";
import type { GroupedMonitors, StatusType } from "../../types";
import { MonitorListItem } from "./monitor-list-item";
import { StatusDot } from "./status-indicator";

interface MonitorGroupsProps {
	monitorGroups: GroupedMonitors[];
	layout?: "vertical" | "horizontal";
	barStyle?: "normal" | "length" | "signal";
}

import { calculateAggregateStatus } from "@/lib/status-utils";

function getGroupStatusText(
	status: StatusType,
	totalMonitors: number,
	operationalCount: number,
): string {
	if (status === "operational") {
		return "All systems operational";
	}
	if (status === "major_outage") {
		return "All systems down";
	}
	if (status === "maintenance_scheduled") {
		return "Scheduled maintenance";
	}
	if (status === "unknown") {
		return totalMonitors === 0 ? "No monitors" : "Status unknown";
	}
	return `${operationalCount}/${totalMonitors} operational`;
}

const MonitorGroupItem = memo(
	({
		group,
		isDefaultExpanded,
		isGrid,
		barStyle,
	}: {
		group: GroupedMonitors;
		isDefaultExpanded: boolean;
		isGrid: boolean;
		barStyle: "normal" | "length" | "signal";
	}) => {
		const isUngrouped = !group.group;
		const [isExpanded, setIsExpanded] = useState(
			isUngrouped || isDefaultExpanded,
		);

		const groupStatus = calculateAggregateStatus(
			group.monitors.map((m) => m.currentStatus),
		);
		const operationalCount = group.monitors.filter(
			(m) => m.currentStatus === "operational",
		).length;
		const statusText = getGroupStatusText(
			groupStatus,
			group.monitors.length,
			operationalCount,
		);

		return (
			<div className="rounded-xl border border-border bg-white">
				{group.group && (
					<button
						type="button"
						onClick={() => setIsExpanded(!isExpanded)}
						className={cn(
							"flex w-full cursor-pointer items-center justify-between rounded-xl px-6 py-4 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700!",
							isExpanded && "border-border border-b",
						)}
					>
						<div className="flex items-center gap-3">
							<ChevronDown
								className={cn(
									"h-4 w-4 text-muted-foreground transition-transform duration-200",
									isExpanded ? "rotate-0" : "-rotate-90",
								)}
							/>
							<h3 className="font-semibold text-base text-foreground">
								{group.group.name}
							</h3>
						</div>
						<div className="flex items-center gap-2.5">
							<span className="text-muted-foreground text-xs">
								{statusText}
							</span>
							<StatusDot status={groupStatus} />
						</div>
					</button>
				)}
				<div
					className={cn(
						"grid transition-all duration-300 ease-in-out",
						isExpanded
							? "grid-rows-[1fr] opacity-100"
							: "pointer-events-none grid-rows-[0fr] opacity-0",
					)}
				>
					<div className="min-h-0">
						<div
							className={cn(
								isGrid
									? "grid grid-cols-1 gap-3 px-6 py-4 md:grid-cols-2"
									: "divide-y divide-border/50 px-6 py-4",
							)}
						>
							{group.monitors.map((monitor) => (
								<MonitorListItem
									key={monitor.id}
									name={monitor.name}
									status={monitor.currentStatus}
									uptimePercentage={monitor.avgUptime}
									history={monitor.history}
									displayStyle={monitor.displayStyle}
									description={monitor.description}
									barStyle={barStyle}
									className={isGrid ? "rounded-lg border p-3" : undefined}
								/>
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
	barStyle = "normal",
}: MonitorGroupsProps) {
	const isGrid = layout === "horizontal";

	return (
		<section className="mb-12 space-y-3">
			{monitorGroups.map((group, index) => (
				<MonitorGroupItem
					key={group.group?.id || `ungrouped-${index}`}
					group={group}
					isDefaultExpanded={index === 0}
					isGrid={isGrid}
					barStyle={barStyle}
				/>
			))}
		</section>
	);
}
