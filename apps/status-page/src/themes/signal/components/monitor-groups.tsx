"use client";

import { ChevronDown, Info } from "lucide-react";
import { useState } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { GroupedMonitors, Monitor } from "../../types";
import { UptimeBar } from "./uptime-bar";

interface MonitorGroupsProps {
	monitorGroups: GroupedMonitors[];
	layout?: "vertical" | "horizontal";
	barStyle?: "normal" | "length";
}

function MonitorCard({
	monitor,
	defaultExpanded,
}: {
	monitor: Monitor;
	defaultExpanded: boolean;
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
							{monitor.avgUptime.toFixed(2)}% uptime
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
						<UptimeBar days={monitor.history} />
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

export function MonitorGroups({ monitorGroups }: MonitorGroupsProps) {
	return (
		<section className="space-y-8">
			{monitorGroups.map((group, groupIndex) => (
				<div
					key={group.group?.id || `ungrouped-${groupIndex}`}
					className="space-y-4"
				>
					{group.group ? (
						<div className="px-1 font-medium text-[13px] text-muted-foreground uppercase tracking-[0.12em]">
							{group.group.name}
						</div>
					) : null}
					<div className="space-y-4">
						{group.monitors.map((monitor, monitorIndex) => (
							<MonitorCard
								key={monitor.id}
								monitor={monitor}
								defaultExpanded={groupIndex === 0 && monitorIndex === 0}
							/>
						))}
					</div>
				</div>
			))}
		</section>
	);
}
