"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { statusConfig } from "../../status-config";
import type { StatusType, UptimeDay } from "../../types";

interface UptimeBarProps {
	days: UptimeDay[];
	className?: string;
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
	maintenance_scheduled: "bg-status-maintenance",
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

export function UptimeBar({ days, className }: UptimeBarProps) {
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
	const segments = buildSegments(days);
	const hoveredDay = hoveredIndex !== null ? days[hoveredIndex] : null;
	const tooltipLeft =
		hoveredIndex !== null
			? `${((hoveredIndex + 0.5) / days.length) * 100}%`
			: "50%";

	return (
		<div className={cn("relative pt-2", className)}>
			<div className="mb-3 flex items-center justify-between gap-4 text-[11px] text-muted-foreground">
				<span>90 days ago</span>
				<div className="signal-divider h-px flex-1" />
				<span>Today</span>
			</div>
			<div className="relative">
				<div className="relative grid grid-cols-90 gap-x-[2px]">
					{segments.map((segment, _index) => (
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

				{/** biome-ignore lint/a11y/noStaticElementInteractions: its okay*/}
				<div
					className="absolute inset-x-0 -top-4 grid h-10 grid-cols-90 gap-x-[2px]"
					onMouseLeave={() => setHoveredIndex(null)}
				>
					{days.map((day, index) => (
						// biome-ignore lint/a11y/noStaticElementInteractions: its okay
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
		</div>
	);
}
