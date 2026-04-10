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
	style?: "normal" | "length" | "signal";
}

interface UptimeSegment {
	start: number;
	length: number;
	status: StatusType;
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

function buildSegments(days: UptimeDay[]): UptimeSegment[] {
	if (days.length === 0) {
		return [];
	}

	const segments: UptimeSegment[] = [];
	let currentStatus = days[0].status;
	let start = 0;

	for (let index = 1; index < days.length; index++) {
		if (days[index].status !== currentStatus) {
			segments.push({
				start,
				length: index - start,
				status: currentStatus,
			});
			currentStatus = days[index].status;
			start = index;
		}
	}

	segments.push({
		start,
		length: days.length - start,
		status: currentStatus,
	});

	return segments;
}

// Get color for stacked bar segments
const segmentColors = {
	uptime: "bg-green-500",
	minor: "bg-yellow-500",
	major: "bg-orange-500",
	critical: "bg-red-500",
	maintenance: "bg-blue-500",
	unknown: "bg-neutral-800",
};

interface BarSegments {
	uptime: number;
	minor: number;
	major: number;
	critical: number;
	maintenance: number;
	unknown: number;
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
		<div className="mt-1 space-y-0.5 border-t pt-1">
			{segs.uptime > 0 && segs.uptime < 100 && (
				<div className="flex items-center gap-1.5 text-[10px]">
					<div className="h-1.5 w-1.5 rounded-full bg-green-500" />
					<span className="text-muted-foreground">
						{segs.uptime.toFixed(0)}% uptime
					</span>
				</div>
			)}
			{segs.minor > 0 && (
				<div className="flex items-center gap-1.5 text-[10px]">
					<div className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
					<span className="text-muted-foreground">
						{segs.minor.toFixed(0)}% minor issues
					</span>
				</div>
			)}
			{segs.major > 0 && (
				<div className="flex items-center gap-1.5 text-[10px]">
					<div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
					<span className="text-muted-foreground">
						{segs.major.toFixed(0)}% major outage
					</span>
				</div>
			)}
			{segs.critical > 0 && (
				<div className="flex items-center gap-1.5 text-[10px]">
					<div className="h-1.5 w-1.5 rounded-full bg-red-500" />
					<span className="text-muted-foreground">
						{segs.critical.toFixed(0)}% critical outage
					</span>
				</div>
			)}
			{segs.maintenance > 0 && (
				<div className="flex items-center gap-1.5 text-[10px]">
					<div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
					<span className="text-muted-foreground">Maintenance</span>
				</div>
			)}
			{segs.unknown > 0 && (
				<div className="flex items-center gap-1.5 text-[10px]">
					<div className="h-1.5 w-1.5 rounded-full bg-neutral-800" />
					<span className="text-muted-foreground">Unknown</span>
				</div>
			)}
		</div>
	);
}

function StackedBar({ segments }: { segments: BarSegments }) {
	const { uptime, minor, major, critical, maintenance, unknown } = segments;

	return (
		<div className="flex h-full w-full flex-col overflow-hidden">
			{uptime > 0 && (
				<div
					className={cn("w-full transition-opacity", segmentColors.uptime)}
					style={{ height: `${uptime}%` }}
				/>
			)}
			{unknown > 0 && (
				<div
					className={cn("w-full transition-opacity", segmentColors.unknown)}
					style={{ height: `${unknown}%` }}
				/>
			)}
			{minor > 0 && (
				<div
					className={cn("w-full transition-opacity", segmentColors.minor)}
					style={{ height: `${minor}%` }}
				/>
			)}
			{major > 0 && (
				<div
					className={cn("w-full transition-opacity", segmentColors.major)}
					style={{ height: `${major}%` }}
				/>
			)}
			{critical > 0 && (
				<div
					className={cn("w-full transition-opacity", segmentColors.critical)}
					style={{ height: `${critical}%` }}
				/>
			)}
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
	const segments = buildSegments(days);

	return (
		<div className={cn("relative w-full", className)}>
			{style === "signal" ? (
				<>
					<div className="mb-3 flex select-none justify-between text-muted-foreground text-xs">
						<span>{days.length} days ago</span>
						<div className="mx-4 my-auto hidden h-px flex-1 bg-border/30 sm:block" />
						<span>Today</span>
					</div>
					<div className="relative">
						<div
							className="relative grid gap-x-[2px]"
							style={{
								gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
							}}
						>
							{segments.map((segment) => (
								<div
									key={`${segment.start}-${segment.status}`}
									className={cn(
										"relative h-1.5 rounded-full transition-opacity",
										statusColors[segment.status],
									)}
									style={{
										gridColumn: `${segment.start + 1} / span ${segment.length}`,
									}}
								/>
							))}
						</div>
						<div
							className="absolute inset-x-0 -top-3 grid h-8 gap-x-[2px]"
							style={{
								gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
							}}
						>
							{days.map((day, index) => (
								<>
									{/* biome-ignore lint/a11y/noStaticElementInteractions: hover-only tooltip target */}
									<div
										key={day.date}
										className="relative h-full"
										onMouseEnter={() => setHoveredIndex(index)}
										onMouseLeave={() => setHoveredIndex(null)}
									>
										{hoveredIndex === index ? (
											<div className="pointer-events-none absolute inset-x-0 top-3 bottom-0">
												<div className="h-1.5 w-full rounded-full bg-black/16 dark:bg-white/18" />
											</div>
										) : null}

										{hoveredIndex === index ? (
											<div className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap">
												<div className="fade-in zoom-in-95 relative animate-in rounded-lg border border-border bg-popover px-2.5 py-1.5 shadow-lg duration-200">
													<div className="font-semibold text-popover-foreground text-xs">
														{day.annotation || statusConfig[day.status].label}
													</div>
													<div className="text-[10px] text-muted-foreground">
														{new Date(day.date).toLocaleDateString("en-US", {
															month: "short",
															day: "numeric",
															timeZone: "UTC",
															hour12: false,
														})}{" "}
														UTC
													</div>
													{day.duration ? (
														<div className="text-[10px] text-muted-foreground">
															{day.duration}
														</div>
													) : (
														day.status !== "unknown" &&
														day.downtimeMs !== undefined &&
														day.downtimeMs > 0 && (
															<div className="text-[10px] text-muted-foreground">
																{formatDowntime(day.downtimeMs)}
															</div>
														)
													)}

													<div className="absolute top-full left-1/2 -ml-2 h-0 w-0 border-8 border-transparent border-t-popover" />
												</div>
											</div>
										) : null}
									</div>
								</>
							))}
						</div>
					</div>
				</>
			) : (
				<>
					<div className="flex h-9 w-full gap-px">
						{days.map((day, index) => (
							<>
								{/* biome-ignore lint/a11y/noStaticElementInteractions: hover-only tooltip target */}
								<div
									key={day.date}
									className="group relative flex-1"
									onMouseEnter={() => setHoveredIndex(index)}
									onMouseLeave={() => setHoveredIndex(null)}
								>
									{style === "length" ? (
										<div
											className={cn(
												"h-full w-full transition-opacity hover:opacity-80",
												index === 0 && "rounded-l-md",
												index === days.length - 1 && "rounded-r-md",
											)}
										>
											<StackedBar segments={calculateSegments(day)} />
										</div>
									) : (
										<div
											className={cn(
												"h-full w-full transition-opacity hover:opacity-80",
												statusColors[day.status],
												index === 0 && "rounded-l-md",
												index === days.length - 1 && "rounded-r-md",
											)}
										/>
									)}

									{hoveredIndex === index && (
										<div className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap">
											<div className="fade-in zoom-in-95 relative animate-in rounded-lg border border-border bg-popover px-2.5 py-1.5 shadow-lg duration-200">
												<div className="font-semibold text-popover-foreground text-xs">
													{day.annotation || statusConfig[day.status].label}
												</div>
												<div className="text-[10px] text-muted-foreground">
													{new Date(day.date).toLocaleDateString("en-US", {
														month: "short",
														day: "numeric",
														timeZone: "UTC",
														hour12: false,
													})}{" "}
													UTC
												</div>
												{style === "length" && <SegmentTooltip day={day} />}
												{day.duration ? (
													<div className="text-[10px] text-muted-foreground">
														{day.duration}
													</div>
												) : (
													day.status !== "unknown" &&
													day.downtimeMs !== undefined &&
													day.downtimeMs > 0 && (
														<div className="text-[10px] text-muted-foreground">
															{formatDowntime(day.downtimeMs)}
														</div>
													)
												)}

												<div className="absolute top-full left-1/2 -ml-2 h-0 w-0 border-8 border-transparent border-t-popover" />
											</div>
										</div>
									)}
								</div>
							</>
						))}
					</div>
				</>
			)}

			{style !== "signal" ? (
				<div className="mt-2 flex select-none justify-between text-muted-foreground text-xs">
					<span>{days.length} days ago</span>
					<div className="mx-4 my-auto hidden h-px flex-1 bg-border/30 sm:block" />
					<span>Today</span>
				</div>
			) : null}
		</div>
	);
}
