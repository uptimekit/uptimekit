"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { statusConfig } from "../../status-config";
import type { StatusType, UptimeDay } from "../../types";

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

interface BarSegments {
	uptime: number;
	minor: number;
	major: number;
	critical: number;
	maintenance: number;
	unknown: number;
}

const statusColors: Record<StatusType, string> = {
	operational: "bg-status-operational",
	degraded: "bg-status-degraded",
	partial_outage: "bg-status-partial-outage",
	major_outage: "bg-status-major-outage",
	maintenance: "bg-status-maintenance",
	maintenance_scheduled: "bg-status-maintenance",
	maintenance_completed: "bg-status-operational",
	unknown: "bg-status-unknown",
};

const segmentColors = {
	uptime: "bg-green-500",
	minor: "bg-yellow-500",
	major: "bg-orange-500",
	critical: "bg-red-500",
	maintenance: "bg-blue-500",
	unknown: "bg-neutral-800",
};

function parseDuration(durationStr: string | undefined): number {
	if (!durationStr) return 0;

	const clean = durationStr.replace(/down/gi, "").trim();
	if (!clean) return 0;

	let totalMs = 0;

	const hoursMatch = clean.match(/(\d+)\s*h/i);
	if (hoursMatch) {
		totalMs += Number.parseInt(hoursMatch[1], 10) * 60 * 60 * 1000;
	}

	const minutesMatch = clean.match(/(\d+)\s*m/i);
	if (minutesMatch) {
		totalMs += Number.parseInt(minutesMatch[1], 10) * 60 * 1000;
	}

	const secondsMatch = clean.match(/(\d+)\s*s/i);
	if (secondsMatch) {
		totalMs += Number.parseInt(secondsMatch[1], 10) * 1000;
	}

	return totalMs;
}

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

function calculateSegments(day: UptimeDay): BarSegments {
	const DAY_MS = 24 * 60 * 60 * 1000;
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
		const downtimeMs = day.downtimeMs || parseDuration(day.duration);
		const downtimePercent = Math.min(100, (downtimeMs / DAY_MS) * 100);

		segments.uptime = Math.max(0, 100 - downtimePercent);

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

function StackedBar({ segments }: { segments: BarSegments }) {
	const { uptime, minor, major, critical, maintenance, unknown } = segments;

	return (
		<div className="flex h-full w-full flex-col overflow-hidden rounded-[2px]">
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
	const hoveredDay = hoveredIndex !== null ? days[hoveredIndex] : null;
	const hoveredSegments =
		style === "length" && hoveredDay ? calculateSegments(hoveredDay) : null;
	const compactGapClassName =
		days.length <= 30 ? "gap-[3px]" : days.length <= 60 ? "gap-[2px]" : "gap-px";
	const tooltipLeft =
		hoveredIndex !== null
			? `${((hoveredIndex + 0.5) / days.length) * 100}%`
			: "50%";

	return (
		<div className={cn("relative pt-2", className)}>
			{style === "signal" ? (
				<>
					<div className="mb-3 flex items-center justify-between gap-4 text-[11px] text-muted-foreground">
						<span>{days.length} days ago</span>
						<div className="signal-divider h-px flex-1" />
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

						{/** biome-ignore lint/a11y/noStaticElementInteractions: visual hover target */}
						<div
							className="absolute inset-x-0 -top-4 grid h-10 gap-x-[2px]"
							style={{
								gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
							}}
							onMouseLeave={() => setHoveredIndex(null)}
						>
							{days.map((day, index) => (
								// biome-ignore lint/a11y/noStaticElementInteractions: visual hover target
								<div
									key={day.date}
									className="relative h-full"
									onMouseEnter={() => setHoveredIndex(index)}
								>
									{hoveredIndex === index ? (
										<div className="pointer-events-none absolute inset-x-0 top-4 bottom-0">
											<div className="h-1.5 w-full rounded-full bg-black/18 dark:bg-white/20" />
										</div>
									) : null}
								</div>
							))}
						</div>
					</div>
				</>
			) : (
				<div className={cn("flex h-10 w-full", compactGapClassName)}>
					{days.map((day, index) => (
						// biome-ignore lint/a11y/noStaticElementInteractions: visual hover target
						<div
							key={day.date}
							className="group relative flex-1 first:rounded-l-md last:rounded-r-md"
							onMouseEnter={() => setHoveredIndex(index)}
							onMouseLeave={() => setHoveredIndex(null)}
						>
							{style === "length" ? (
								<div className="h-full w-full rounded-[2px] transition-opacity hover:opacity-80">
									<StackedBar segments={calculateSegments(day)} />
								</div>
							) : (
								<div
									className={cn(
										"h-full w-full rounded-[2px] transition-opacity hover:opacity-80",
										statusColors[day.status],
									)}
								/>
							)}
						</div>
					))}
				</div>
			)}

			<AnimatePresence>
				{hoveredDay ? (
					<motion.div
						initial={{ opacity: 0, y: 6, scale: 0.98 }}
						animate={{
							opacity: 1,
							y: 0,
							scale: 1,
							left: tooltipLeft,
						}}
						exit={{ opacity: 0, y: 4, scale: 0.985 }}
						transition={{
							left: {
								type: "spring",
								stiffness: 380,
								damping: 30,
								mass: 0.45,
							},
							opacity: { duration: 0.14, ease: [0.2, 0, 0, 1] },
							y: { duration: 0.14, ease: [0.2, 0, 0, 1] },
							scale: { duration: 0.14, ease: [0.2, 0, 0, 1] },
						}}
						className="pointer-events-auto absolute bottom-[calc(100%+1px)] z-50 -translate-x-1/2"
					>
						<div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
							<div
								className={cn(
									"px-4 py-3",
									hoveredDay.status === "operational"
										? "bg-status-operational/12 text-status-operational"
										: hoveredDay.status === "degraded"
											? "bg-status-degraded/12 text-status-degraded"
											: hoveredDay.status === "partial_outage"
												? "bg-status-partial-outage/12 text-status-partial-outage"
												: hoveredDay.status === "major_outage"
													? "bg-status-major-outage/12 text-status-major-outage"
													: hoveredDay.status === "maintenance" ||
															hoveredDay.status === "maintenance_scheduled"
														? "bg-status-maintenance/12 text-status-maintenance"
														: "bg-muted text-muted-foreground",
								)}
							>
								<div className="font-semibold text-[12px]">
									{statusConfig[hoveredDay.status].label}
								</div>
								{hoveredDay.duration ? (
									<div className="mt-1 text-[12px] opacity-85">
										{hoveredDay.duration}
									</div>
								) : hoveredDay.status !== "unknown" ? (
									<div className="mt-1 text-[12px] opacity-85">
										{hoveredDay.downtimeMs !== undefined &&
										hoveredDay.downtimeMs > 0
											? formatDowntime(hoveredDay.downtimeMs)
											: "No downtime"}
									</div>
								) : null}
							</div>
							<div className="min-w-56 bg-card px-4 py-3 font-medium text-[12px] text-foreground">
								{new Date(hoveredDay.date).toLocaleDateString("en-US", {
									month: "short",
									day: "numeric",
									year: "numeric",
									timeZone: "UTC",
								})}
							</div>
							{style === "length" ? (
								<div className="border-border border-t bg-muted/45 px-4 py-3">
									<div className="space-y-1 text-[12px] text-foreground/80">
										{hoveredSegments &&
										hoveredSegments.uptime > 0 &&
										hoveredSegments.uptime < 100 ? (
											<div>{hoveredSegments.uptime.toFixed(0)}% uptime</div>
										) : null}
										{hoveredSegments && hoveredSegments.minor > 0 ? (
											<div>
												{hoveredSegments.minor.toFixed(0)}% minor issues
											</div>
										) : null}
										{hoveredSegments && hoveredSegments.major > 0 ? (
											<div>
												{hoveredSegments.major.toFixed(0)}% major outage
											</div>
										) : null}
										{hoveredSegments && hoveredSegments.critical > 0 ? (
											<div>
												{hoveredSegments.critical.toFixed(0)}% critical outage
											</div>
										) : null}
										{hoveredSegments && hoveredSegments.maintenance > 0 ? (
											<div>
												{hoveredSegments.maintenance.toFixed(0)}% maintenance
											</div>
										) : null}
										{hoveredSegments && hoveredSegments.unknown > 0 ? (
											<div>{hoveredSegments.unknown.toFixed(0)}% unknown</div>
										) : null}
									</div>
								</div>
							) : null}
							{hoveredDay.annotation &&
							hoveredDay.annotation !==
								statusConfig[hoveredDay.status].label ? (
								<div className="border-border border-t bg-muted/45 px-4 py-3">
									<div className="font-medium text-[11px] text-muted-foreground">
										Related
									</div>
									<div className="mt-1 max-w-56 text-[12px] text-foreground/80">
										{hoveredDay.annotation}
									</div>
								</div>
							) : null}
						</div>
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
}
