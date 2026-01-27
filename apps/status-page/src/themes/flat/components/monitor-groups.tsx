"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { MonitorListItem } from "./monitor-list-item";
import { StatusDot, type StatusType } from "./status-indicator";
import type { GroupedMonitors } from "../../types";
import { cn } from "@/lib/utils";

interface MonitorGroupsProps {
	monitorGroups: GroupedMonitors[];
}

function calculateGroupStatus(
	monitors: GroupedMonitors["monitors"],
): StatusType {
	if (monitors.length === 0) return "unknown";

	const statuses = monitors.map((m) => m.currentStatus);

	if (statuses.every((s) => s === "operational")) {
		return "operational";
	}

	if (statuses.some((s) => s === "major_outage" || s === "partial_outage")) {
		if (
			statuses.every((s) => s === "major_outage" || s === "partial_outage")
		) {
			return "major_outage";
		}
		return "partial_outage";
	}

	if (statuses.some((s) => s === "degraded")) {
		return "degraded";
	}
	if (statuses.some((s) => s === "maintenance")) {
		return "maintenance";
	}

	return "operational";
}

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
	return `${operationalCount}/${totalMonitors} operational`;
}

export function MonitorGroups({ monitorGroups }: MonitorGroupsProps) {
	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
		const firstGroupId = monitorGroups[0]?.group?.id || "ungrouped-0";
		return new Set([firstGroupId]);
	});

	const toggleGroup = (groupId: string) => {
		setExpandedGroups((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(groupId)) {
				newSet.delete(groupId);
			} else {
				newSet.add(groupId);
			}
			return newSet;
		});
	};

	return (
		<section className="mb-12 space-y-3">
			{monitorGroups.map((group, index) => {
				const groupId = group.group?.id || `ungrouped-${index}`;
				const isExpanded = expandedGroups.has(groupId);
				const groupStatus = calculateGroupStatus(group.monitors);
				const operationalCount = group.monitors.filter(
					(m) => m.currentStatus === "operational",
				).length;
				const statusText = getGroupStatusText(
					groupStatus,
					group.monitors.length,
					operationalCount,
				);

				return (
					<div
						key={groupId}
						className="rounded-xl border border-border bg-white"
					>
						{group.group && (
							<button
								type="button"
								onClick={() => toggleGroup(groupId)}
								className={cn(
									"flex w-full items-center justify-between rounded-xl px-6 py-4 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700!",
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
									<h3 className="font-semibold text-foreground text-base">
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
									: "grid-rows-[0fr] opacity-0 pointer-events-none",
							)}
						>
							<div className="min-h-0">
								<div className="divide-y divide-border/50 px-6 py-4">
									{group.monitors.map((monitor) => (
										<MonitorListItem
											key={monitor.id}
											name={monitor.name}
											status={monitor.currentStatus}
											uptimePercentage={monitor.avgUptime}
											history={monitor.history}
											displayStyle={monitor.displayStyle}
											description={monitor.description}
										/>
									))}
								</div>
							</div>
						</div>
					</div>
				);
			})}
		</section>
	);
}
