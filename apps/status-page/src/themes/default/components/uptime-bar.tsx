"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { statusConfig } from "../../status-config";
import type { StatusType, UptimeDay } from "../../types";

/**
 * Convert a duration in milliseconds into a concise human-readable downtime string.
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

/**
 * Parse a duration string into milliseconds.
 * Handles formats like: "5h 15m", "6m", "30s down", "5h down", etc.
 */
function parseDuration(durationStr: string | undefined): number {
	if (!durationStr) return 0;

	// Remove "down" suffix and trim
	const clean = durationStr.replace(/down/gi, "").trim();
	if (!clean) return 0;

	let totalMs = 0;

	// Parse hours (e.g., "5h" or "5 h")
	const hoursMatch = clean.match(/(\d+)\s*h/i);
	if (hoursMatch) {
		totalMs += Number.parseInt(hoursMatch[1], 10) * 60 * 60 * 1000;
	}

	// Parse minutes (e.g., "15m" or "15 m")
	const minutesMatch = clean.match(/(\d+)\s*m/i);
	if (minutesMatch) {
		totalMs += Number.parseInt(minutesMatch[1], 10) * 60 * 1000;
	}

	// Parse seconds (e.g., "30s" or "30 s")
	const secondsMatch = clean.match(/(\d+)\s*s/i);
	if (secondsMatch) {
		totalMs += Number.parseInt(secondsMatch[1], 10) * 1000;
	}

	return totalMs;
}

interface UptimeBarProps {
	days: UptimeDay[];
	className?: string;
	style?: "normal" | "length";
}

const statusColors: Record<StatusType, string> = {
	operational: "bg-status-operational",
	degraded: "bg-status-degraded",
	partial_outage: "bg-status-partial-outage",
	major_outage: "bg-status-major-outage",
	maintenance: "bg-status-maintenance",
	maintenance_scheduled: "bg-status-partial-outage",
	maintenance_completed: "bg-status-operational",
	unknown: "bg-status-unknown/20",
};

// Get color for stacked bar segments
const segmentColors = {
	uptime: "bg-green-500",
	minor: "bg-yellow-500", // degraded
	major: "bg-orange-500", // partial_outage
	critical: "bg-red-500", // major_outage
	maintenance: "bg-blue-500",
	unknown: "bg-neutral-800",
};

interface BarSegments {
	uptime: number; // percentage (0-100)
	minor: number; // percentage
	major: number; // percentage
	critical: number; // percentage
	maintenance: number; // percentage
	unknown: number; // percentage
}

function calculateSegments(day: UptimeDay): BarSegments {
	const DAY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
	const segments: BarSegments = {
		uptime: 100,
		minor: 0,
		major: 0,
		critical: 0,
		maintenance: 0,
		unknown: 0,
	};

	if (day.status === "operational" || day.status === "maintenance_completed") {
		segments.uptime = 100;
	} else if (day.status === "unknown") {
		segments.unknown = 100;
		segments.uptime = 0;
	} else {
		// Calculate actual downtime proportion - use downtimeMs or parse duration string
		const downtimeMs = day.downtimeMs || parseDuration(day.duration);
		const downtimePercent = Math.min(100, (downtimeMs / DAY_MS) * 100);

		// Uptime is what's left after downtime
		segments.uptime = Math.max(0, 100 - downtimePercent);

		// Assign downtime to appropriate severity category
		if (
			day.status === "maintenance" ||
			day.status === "maintenance_scheduled"
		) {
			segments.maintenance = downtimePercent;
		} else if (day.status === "degraded") {
			segments.minor = downtimePercent;
		} else if (day.status === "partial_outage") {
			segments.major = downtimePercent;
		} else if (day.status === "major_outage") {
			segments.critical = downtimePercent;
		}
	}

	return segments;
}

function SegmentTooltip({ day }: { day: UptimeDay }) {
	const segs = calculateSegments(day);

	return (
		<div className="mt-2 space-y-1 border-t pt-2">
			{segs.uptime > 0 && segs.uptime < 100 && (
				<div className="flex items-center gap-2 text-xs">
					<div className="h-2 w-2 rounded-full bg-green-500" />
					<span className="text-muted-foreground">
						{segs.uptime.toFixed(0)}% uptime
					</span>
				</div>
			)}
			{segs.minor > 0 && (
				<div className="flex items-center gap-2 text-xs">
					<div className="h-2 w-2 rounded-full bg-yellow-500" />
					<span className="text-muted-foreground">
						{segs.minor.toFixed(0)}% minor issues
					</span>
				</div>
			)}
			{segs.major > 0 && (
				<div className="flex items-center gap-2 text-xs">
					<div className="h-2 w-2 rounded-full bg-orange-500" />
					<span className="text-muted-foreground">
						{segs.major.toFixed(0)}% major outage
					</span>
				</div>
			)}
			{segs.critical > 0 && (
				<div className="flex items-center gap-2 text-xs">
					<div className="h-2 w-2 rounded-full bg-red-500" />
					<span className="text-muted-foreground">
						{segs.critical.toFixed(0)}% critical outage
					</span>
				</div>
			)}
			{segs.maintenance > 0 && (
				<div className="flex items-center gap-2 text-xs">
					<div className="h-2 w-2 rounded-full bg-blue-500" />
					<span className="text-muted-foreground">Maintenance</span>
				</div>
			)}
			{segs.unknown > 0 && (
				<div className="flex items-center gap-2 text-xs">
					<div className="h-2 w-2 rounded-full bg-gray-400" />
					<span className="text-muted-foreground">Unknown</span>
				</div>
			)}
		</div>
	);
}

function StackedBar({ segments }: { segments: BarSegments }) {
	const { uptime, minor, major, critical, maintenance, unknown } = segments;

	return (
		<div className="flex h-full w-full flex-col overflow-hidden rounded-[1px]">
			{/* Uptime - top portion */}
			{uptime > 0 && (
				<div
					className={cn("w-full transition-opacity", segmentColors.uptime)}
					style={{ height: `${uptime}%` }}
				/>
			)}
			{/* Unknown status - gray */}
			{unknown > 0 && (
				<div
					className={cn("w-full transition-opacity", segmentColors.unknown)}
					style={{ height: `${unknown}%` }}
				/>
			)}
			{/* Minor issues */}
			{minor > 0 && (
				<div
					className={cn("w-full transition-opacity", segmentColors.minor)}
					style={{ height: `${minor}%` }}
				/>
			)}
			{/* Major issues */}
			{major > 0 && (
				<div
					className={cn("w-full transition-opacity", segmentColors.major)}
					style={{ height: `${major}%` }}
				/>
			)}
			{/* Critical issues */}
			{critical > 0 && (
				<div
					className={cn("w-full transition-opacity", segmentColors.critical)}
					style={{ height: `${critical}%` }}
				/>
			)}
			{/* Maintenance */}
			{maintenance > 0 && (
				<div
					className={cn("w-full transition-opacity", segmentColors.maintenance)}
					style={{ height: `${maintenance}%` }}
				/>
			)}
		</div>
	);
}

export function UptimeBar({
	days,
	className,
	style = "normal",
}: UptimeBarProps) {
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

	return (
		<div className={cn("relative w-full", className)}>
			{/* Flex container for the bar segments */}
			<div className="flex h-8 w-full gap-[3px]">
				{days.map((day, index) => (
					// biome-ignore lint/a11y/noStaticElementInteractions
					<div
						key={day.date}
						className="group relative flex-1 first:rounded-l-sm last:rounded-r-sm"
						onMouseEnter={() => setHoveredIndex(index)}
						onMouseLeave={() => setHoveredIndex(null)}
					>
						{/* The visible bar segment */}
						{style === "length" ? (
							<div className="h-full w-full rounded-[1px] transition-opacity hover:opacity-80">
								<StackedBar segments={calculateSegments(day)} />
							</div>
						) : (
							<div
								className={cn(
									"h-full w-full rounded-[1px] transition-opacity hover:opacity-80",
									statusColors[day.status],
								)}
							/>
						)}

						{/* Tooltip */}
						{hoveredIndex === index && (
							<div className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap">
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
									{style === "length" && <SegmentTooltip day={day} />}
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
									<div className="absolute top-full left-1/2 -ml-2 h-0 w-0 border-8 border-transparent border-t-popover" />
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
