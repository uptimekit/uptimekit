"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { type StatusType, statusConfig } from "./status-indicator";

export interface UptimeDay {
	date: string;
	status: StatusType;
	uptime: number;
	downtimeMs?: number; // Downtime in milliseconds for displaying
	annotation?: string;
	duration?: string;
}

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
	unknown: "bg-status-unknown/20",
};

export function UptimeBar({ days, className }: UptimeBarProps) {
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

	return (
		<div className={cn("relative w-full", className)}>
			{/* Flex container for the bar segments */}
			<div className="flex h-8 w-full gap-[3px]">
				{days.map((day, index) => (
					// biome-ignore lint/a11y/noStaticElementInteractions: This div acts as a visual container for a bar segment that triggers a tooltip on mouse hover. It is not intended to be a keyboard-navigable or actionable interactive control, so adding roles like `button` or `link` or `tabIndex` would be semantically incorrect and misleading for assistive technologies.
					<div
						key={day.date}
						className="group relative flex-1 first:rounded-l-sm last:rounded-r-sm"
						onMouseEnter={() => setHoveredIndex(index)}
						onMouseLeave={() => setHoveredIndex(null)}
					>
						{/* The visible bar segment */}
						<div
							className={cn(
								"h-full w-full rounded-[1px] transition-opacity hover:opacity-80",
								statusColors[day.status],
							)}
						/>

						{/* Tooltip */}
						{hoveredIndex === index && (
							<div className="-translate-x-1/2 absolute bottom-full left-1/2 z-20 mb-2 whitespace-nowrap">
								<div className="fade-in zoom-in-95 relative animate-in rounded-lg border border-border bg-popover px-3 py-2 shadow-xl duration-200">
									<div className="font-semibold text-popover-foreground text-sm">
										{day.annotation || statusConfig[day.status].label}
									</div>
									<div className="mt-1 text-muted-foreground text-xs">
										{new Date(day.date).toLocaleDateString("en-US", {
											weekday: "long",
											month: "short",
											day: "numeric",
											year: "numeric",
										})}
									</div>
									{day.duration ? (
										<div className="mt-1 text-muted-foreground text-xs">
											Duration: {day.duration}
										</div>
									) : (
										day.status !== "unknown" && (
											<div className="mt-1 text-muted-foreground text-xs">
												{day.downtimeMs !== undefined && day.downtimeMs > 0
													? formatDowntime(day.downtimeMs)
													: "No downtime"}
											</div>
										)
									)}

									{/* Arrow */}
									<div className="-ml-2 absolute top-full left-1/2 h-0 w-0 border-8 border-transparent border-t-popover" />
								</div>
							</div>
						)}
					</div>
				))}
			</div>

			{/* Legend / Labels */}
			<div className="mt-2 flex select-none justify-between text-muted-foreground/60 text-xs">
				<span>{days.length} days ago</span>
				<div className="mx-4 my-auto hidden h-px flex-1 bg-border/30 sm:block" />
				<span>Today</span>
			</div>
		</div>
	);
}

export function generateMockUptimeData(days = 90): UptimeDay[] {
	const data: UptimeDay[] = [];
	const now = new Date();

	for (let i = days - 1; i >= 0; i--) {
		const date = new Date(now);
		date.setDate(date.getDate() - i);
		// ... (mock generation if needed for testing locally, but we are moving to real data)
		// keeping implementation simple for now or removing if unused.
		// Let's just return empty or random for fallback to avoid breakage imports.
		const random = Math.random();
		let status: StatusType;
		let uptime: number;

		if (random > 0.98) {
			status = "major_outage";
			uptime = 85 + Math.random() * 10;
		} else if (random > 0.95) {
			status = "partial_outage";
			uptime = 95 + Math.random() * 3;
		} else if (random > 0.92) {
			status = "degraded";
			uptime = 98 + Math.random() * 1.5;
		} else if (random > 0.9) {
			status = "maintenance";
			uptime = 99 + Math.random() * 0.8;
		} else {
			status = "operational";
			uptime = 100;
		}
		data.push({
			date: date.toISOString().split("T")[0],
			status,
			uptime,
		});
	}

	return data;
}