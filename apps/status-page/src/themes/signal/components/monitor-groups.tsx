"use client";

import { useState } from "react";
import { ChevronDown, Info } from "@/components/icons";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { getSectionStatus, getSectionStatusText } from "@/lib/section-status";
import { cn } from "@/lib/utils";
import type { GroupedMonitors, Monitor } from "../../types";
import { StatusDot } from "./status-indicator";
import { UptimeBar } from "./uptime-bar";

interface MonitorGroupsProps {
	monitorGroups: GroupedMonitors[];
	layout?: "vertical" | "horizontal";
	barStyle?: "normal" | "length" | "signal";
	toFixed?: number;
}

function MonitorCard({
	monitor,
	defaultExpanded,
	barStyle,
	toFixed,
}: {
	monitor: Monitor;
	defaultExpanded: boolean;
	barStyle: "normal" | "length" | "signal";
	toFixed: number;
}) {
	const [isExpanded, setIsExpanded] = useState(defaultExpanded);

	return (
		<div className="signal-panel rounded-2xl border border-border">
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
						<div className="flex min-w-0 items-center gap-2">
							<span className="truncate font-medium text-[15px] text-foreground">
								{monitor.name}
							</span>
							{monitor.description ? (
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
										<p className="max-w-xs text-sm">{monitor.description}</p>
									</TooltipContent>
								</Tooltip>
							) : null}
						</div>
						<div className="shrink-0 font-medium text-[13px] text-muted-foreground">
							{monitor.avgUptime.toFixed(toFixed)}% uptime
						</div>
					</div>
				</div>
			</button>

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
					<div className="px-4 py-4 sm:px-5 sm:py-5">
						<UptimeBar
							days={monitor.history}
							style={barStyle}
							toFixed={toFixed}
						/>
						{monitor.displayStyle === "status" ? (
							<div className="mt-4 text-[13px] text-muted-foreground">
								Current state: {monitor.currentStatus.replaceAll("_", " ")}
							</div>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
}

export function MonitorGroups({
	monitorGroups,
	layout = "vertical",
	barStyle = "normal",
	toFixed = 2,
}: MonitorGroupsProps) {
	const isGrid = layout === "horizontal";

	return (
		<section className="space-y-8">
			{monitorGroups.map((group, groupIndex) => (
				<MonitorGroupSection
					key={group.group?.id || `ungrouped-${groupIndex}`}
					group={group}
					groupIndex={groupIndex}
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
	groupIndex,
	isGrid,
	barStyle,
	toFixed,
}: {
	group: GroupedMonitors;
	groupIndex: number;
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
		<div className="space-y-4">
			{group.group && isCollapsible ? (
				<button
					type="button"
					aria-expanded={isExpanded}
					onClick={() => setIsExpanded((current) => !current)}
					className="signal-panel flex w-full items-center justify-between gap-4 rounded-2xl border border-border px-4 py-3 text-left sm:px-5"
				>
					<div className="flex min-w-0 items-center gap-3">
						<ChevronDown
							className={cn(
								"h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
								!isExpanded && "-rotate-90",
							)}
						/>
						<div className="truncate font-medium text-muted-foreground text-sm">
							{group.group.name}
						</div>
					</div>
					<div className="flex shrink-0 items-center gap-2.5">
						<span className="hidden text-muted-foreground text-xs sm:inline">
							{statusText}
						</span>
						<StatusDot status={sectionStatus} />
					</div>
				</button>
			) : group.group ? (
				<div className="flex items-center justify-between gap-4 px-1">
					<div className="font-medium text-muted-foreground text-sm">
						{group.group.name}
					</div>
					<div className="flex items-center gap-2.5">
						<span className="text-muted-foreground text-xs">{statusText}</span>
						<StatusDot status={sectionStatus} />
					</div>
				</div>
			) : null}
			<div
				aria-hidden={!isExpanded}
				inert={!isExpanded}
				className={cn(
					"grid transition-all duration-300 ease-in-out",
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
							isGrid ? "grid grid-cols-1 gap-4 md:grid-cols-2" : "space-y-4",
						)}
					>
						{group.monitors.map((monitor, monitorIndex) => (
							<MonitorCard
								key={monitor.id}
								monitor={monitor}
								defaultExpanded={groupIndex === 0 && monitorIndex === 0}
								barStyle={barStyle}
								toFixed={toFixed}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
