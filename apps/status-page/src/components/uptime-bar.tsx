"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { StatusType } from "./status-indicator";

export interface UptimeDay {
	date: string;
	status: StatusType;
	uptime: number;
	annotation?: string;
	duration?: string;
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
										{day.annotation ||
											(day.status === "operational"
												? "Operational"
												: day.status.replace("_", " "))}
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
												{day.uptime.toFixed(2)}% uptime
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
