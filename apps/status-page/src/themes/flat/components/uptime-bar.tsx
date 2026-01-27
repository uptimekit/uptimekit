"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { statusConfig } from "../../status-config";
import type { StatusType, UptimeDay } from "../../types";

/**
 * Convert a duration in milliseconds into a concise human-readable downtime string.
 *
 * @param ms - Downtime duration in milliseconds.
 * @returns `"No downtime"` if `ms` is less than or equal to zero; otherwise a string describing the duration using hours, minutes, and/or seconds (e.g. `5h 3m down`, `12m 4s down`, `30s down`).
 */
function formatDowntime(ms: number): string {
	if (ms <= 0) return "No downtime";

	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (hours > 0) {
		const remainingMinutes = minutes % 60;
		return remainingMinutes > 0
			? `${hours}h ${remainingMinutes}m down`
			: `${hours}h down`;
	}
	if (minutes > 0) {
		const remainingSeconds = seconds % 60;
		return remainingSeconds > 0
			? `${minutes}m ${remainingSeconds}s down`
			: `${minutes}m down`;
	}
	return `${seconds}s down`;
}

interface UptimeBarProps {
	days: UptimeDay[];
	className?: string;
}

const statusColors: Record<StatusType, string> = {
	operational: "bg-status-operational",
	degraded: "bg-status-degraded",
	partial_outage: "bg-status-partial-outage",
	major_outage: "bg-status-major-outage",
	maintenance: "bg-status-maintenance",
	maintenance_scheduled: "bg-status-partial-outage",
	maintenance_completed: "bg-status-operational",
	unknown: "bg-status-unknown",
};

export function UptimeBar({ days, className }: UptimeBarProps) {
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

	return (
		<div className={cn("relative w-full", className)}>
			<div className="flex h-9 w-full gap-px">
				{days.map((day, index) => (
					// biome-ignore lint/a11y/noStaticElementInteractions: This div acts as a visual container for a bar segment that triggers a tooltip on mouse hover. It is not intended to be a keyboard-navigable or actionable interactive control, so adding roles like `button` or `link` or `tabIndex` would be semantically incorrect and misleading for assistive technologies.
					<div
						key={day.date}
						className="group relative flex-1"
						onMouseEnter={() => setHoveredIndex(index)}
						onMouseLeave={() => setHoveredIndex(null)}
					>

						<div
							className={cn(
								"h-full w-full transition-opacity hover:opacity-80",
								statusColors[day.status],
								index === 0 && "rounded-l-md",
								index === days.length - 1 && "rounded-r-md",
							)}
						/>


						{hoveredIndex === index && (
							<div className="-translate-x-1/2 absolute bottom-full left-1/2 z-20 mb-2 whitespace-nowrap">
								<div className="fade-in zoom-in-95 relative animate-in rounded-lg border border-border bg-popover px-2.5 py-1.5 shadow-lg duration-200">
									<div className="font-semibold text-popover-foreground text-xs">
										{day.annotation || statusConfig[day.status].label}
									</div>
									<div className="text-muted-foreground text-[10px]">
										{new Date(day.date).toLocaleDateString("en-US", {
											month: "short",
											day: "numeric",
											timeZone: "UTC",
											hour12: false,
										})} UTC
									</div>
									{day.duration ? (
										<div className="text-muted-foreground text-[10px]">
											{day.duration}
										</div>
									) : (
										day.status !== "unknown" &&
										day.downtimeMs !== undefined &&
										day.downtimeMs > 0 && (
											<div className="text-muted-foreground text-[10px]">
												{formatDowntime(day.downtimeMs)}
											</div>
										)
									)}

									<div className="-ml-2 absolute top-full left-1/2 h-0 w-0 border-8 border-transparent border-t-popover" />
								</div>
							</div>
						)}
					</div>
				))}
			</div>

			<div className="mt-2 flex select-none justify-between text-muted-foreground text-xs">
				<span>{days.length} days ago</span>
				<div className="mx-4 my-auto hidden h-px flex-1 bg-border/30 sm:block" />
				<span>Today</span>
			</div>
		</div>
	);
}
