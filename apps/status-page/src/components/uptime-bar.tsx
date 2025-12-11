"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { StatusType } from "./status-indicator";

interface UptimeDay {
	date: string;
	status: StatusType;
	uptime: number;
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
	unknown: "bg-status-unknown/50",
};

export function UptimeBar({ days, className }: UptimeBarProps) {
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

	return (
		<div className={cn("relative", className)}>
			<div className="uptime-bar">
				{days.map((day, index) => (
					<div
						key={day.date}
						className="group relative"
						onMouseEnter={() => setHoveredIndex(index)}
						onMouseLeave={() => setHoveredIndex(null)}
					>
						<div
							className={cn(
								"uptime-bar-segment cursor-pointer",
								statusColors[day.status],
							)}
						/>
						{hoveredIndex === index && (
							<div className="-translate-x-1/2 absolute bottom-full left-1/2 z-10 mb-2 whitespace-nowrap">
								<div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-lg">
									<div className="font-medium text-popover-foreground">
										{new Date(day.date).toLocaleDateString("en-US", {
											weekday: "short",
											month: "short",
											day: "numeric",
										})}
									</div>
									<div className="mt-0.5 text-muted-foreground">
										{day.uptime.toFixed(2)}% uptime
									</div>
								</div>
								<div className="-translate-x-1/2 absolute top-full left-1/2 border-4 border-transparent border-t-popover" />
							</div>
						)}
					</div>
				))}
			</div>
			<div className="mt-2 flex justify-between text-muted-foreground text-xs">
				<span>{days.length} days ago</span>
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
			uptime = 99.9 + Math.random() * 0.1;
		}

		data.push({
			date: date.toISOString().split("T")[0],
			status,
			uptime,
		});
	}

	return data;
}
