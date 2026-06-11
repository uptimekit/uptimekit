"use client";

import { useState } from "react";
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

export function MonitorGroups({
	monitorGroups,
	layout = "vertical",
	barStyle = "normal",
	toFixed = 2,
}: MonitorGroupsProps) {
	const isGrid = layout === "horizontal";

	return (
		<section className="mb-16 space-y-8">
			{monitorGroups.map((group) => (
				<MonitorGroupSection
					key={group.group?.id || "ungrouped"}
					group={group}
					isGrid={isGrid}
					barStyle={barStyle}
					toFixed={toFixed}
				/>
			))}
		</section>
	);
}

function MonitorGroupSection({
	group,
	isGrid,
	barStyle,
	toFixed,
}: {
	group: GroupedMonitors;
	isGrid: boolean;
	barStyle: "normal" | "length" | "signal";
	toFixed: number;
}) {
	const isCollapsible = group.group ? group.group.collapsible !== false : false;
	const [isExpanded, setIsExpanded] = useState(
		!isCollapsible || !group.group?.defaultCollapsed,
	);
	const sectionStatus = getSectionStatus(group.monitors);
	const statusText = getSectionStatusText(sectionStatus, group.monitors.length);

	return (
		<div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
			{group.group ? (
				isCollapsible ? (
					<button
						type="button"
						aria-expanded={isExpanded}
						onClick={() => setIsExpanded((current) => !current)}
						className={cn(
							"flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-muted/50",
							isExpanded && "border-border border-b",
						)}
					>
						<div className="flex min-w-0 items-center gap-3">
							<ChevronDown
								className={cn(
									"h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
									!isExpanded && "-rotate-90",
								)}
							/>
							<h3 className="truncate font-bold text-foreground text-xl">
								{group.group.name}
							</h3>
						</div>
						<div className="flex shrink-0 items-center gap-2.5">
							<span className="hidden text-muted-foreground text-xs sm:inline">
								{statusText}
							</span>
							<StatusDot status={sectionStatus} />
						</div>
					</button>
				) : (
					<div className="px-6 pt-6">
						<h3 className="font-bold text-foreground text-xl">
							{group.group.name}
						</h3>
					</div>
				)
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
								? "grid grid-cols-1 gap-4 md:grid-cols-2"
								: "divide-y divide-border",
							group.group ? "px-6 py-4" : "p-6",
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
								toFixed={toFixed}
								barStyle={barStyle}
								variant={isGrid ? "card" : "list"}
								className={isGrid ? "rounded-lg border p-4" : undefined}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
