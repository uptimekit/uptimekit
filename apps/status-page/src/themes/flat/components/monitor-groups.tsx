"use client";

import { memo, useState } from "react";
import { ChevronDown } from "@/components/icons";
import { getSectionStatus, getSectionStatusText } from "@/lib/section-status";
import { cn } from "@/lib/utils";
import type { GroupedMonitors } from "../../types";
import { MonitorListItem } from "./monitor-list-item";
import { StatusDot } from "./status-indicator";

interface MonitorGroupsProps {
	monitorGroups: GroupedMonitors[];
	layout?: "vertical" | "horizontal";
	barStyle?: "normal" | "length" | "signal";
	toFixed?: number;
}

const MonitorGroupItem = memo(
	({
		group,
		isGrid,
		barStyle,
		toFixed,
	}: {
		group: GroupedMonitors;
		isGrid: boolean;
		barStyle: "normal" | "length" | "signal";
		toFixed: number;
	}) => {
		const isUngrouped = !group.group;
		const isCollapsible = group.group
			? group.group.collapsible !== false
			: false;
		const [isExpanded, setIsExpanded] = useState(
			isUngrouped || !isCollapsible || !group.group?.defaultCollapsed,
		);

		const groupStatus = getSectionStatus(group.monitors);
		const statusText = getSectionStatusText(groupStatus, group.monitors.length);

		return (
			<div className="rounded-xl border border-border bg-white">
				{group.group && isCollapsible ? (
					<button
						type="button"
						aria-expanded={isExpanded}
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
				) : group.group ? (
					<div className="flex items-center justify-between gap-4 px-6 py-4">
						<h3 className="font-semibold text-base text-foreground">
							{group.group.name}
						</h3>
						<div className="flex items-center gap-2.5">
							<span className="text-muted-foreground text-xs">
								{statusText}
							</span>
							<StatusDot status={groupStatus} />
						</div>
					</div>
				) : null}
				<div
					className={cn(
						"grid transition-all duration-300 ease-in-out",
						isExpanded
							? "grid-rows-[1fr] opacity-100"
							: "pointer-events-none grid-rows-[0fr] opacity-0",
					)}
				>
					<div className="min-h-0 overflow-hidden">
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
									toFixed={toFixed}
									variant={isGrid ? "card" : "list"}
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
	toFixed = 2,
}: MonitorGroupsProps) {
	const isGrid = layout === "horizontal";

	return (
		<section className="mb-12 space-y-3">
			{monitorGroups.map((group, index) => (
				<MonitorGroupItem
					key={group.group?.id || `ungrouped-${index}`}
					group={group}
					isGrid={isGrid}
					barStyle={barStyle}
					toFixed={toFixed}
				/>
			))}
		</section>
	);
}
