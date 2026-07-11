"use client";

import { AnimatePresence, domAnimation, LazyMotion, m } from "motion/react";
import { type MouseEvent, useState } from "react";
import { ViewportTooltip } from "@/components/viewport-tooltip";
import {
    getViewportTooltipPosition,
    type ViewportTooltipPosition,
} from "@/components/viewport-tooltip-position";
import { cn } from "@/lib/utils";
import { statusConfig } from "../../status-config";
import type { StatusType, UptimeDay } from "../../types";

interface UptimeBarProps {
    days: UptimeDay[];
    className?: string;
    style?: "normal" | "length" | "signal";
    toFixed?: number;
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

function isMaintenanceStatus(status: StatusType): boolean {
    return status === "maintenance" || status === "maintenance_scheduled";
}

function formatMaintenanceDuration(day: UptimeDay): string {
    const maintenanceMs = day.maintenanceMs ?? parseDuration(day.duration);

    if (maintenanceMs <= 0) {
        return "Maintenance excluded from uptime";
    }

    return `${formatDowntime(maintenanceMs).replace(/ down$/, "")} maintenance`;
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

export function UptimePreview({ days }: { days: UptimeDay[] }) {
    const previewDays = days.slice(-14);
    const segments = buildSegments(previewDays);

    return (
        <div
            className="hidden h-1.5 w-28 grid-cols-[repeat(14,minmax(0,1fr))] gap-x-[3px] min-[400px]:grid"
            aria-hidden="true"
        >
            {segments.map((segment) => (
                <div
                    key={`${segment.start}-${segment.status}`}
                    className={cn(
                        "h-1.5 rounded-full",
                        statusColors[segment.status],
                    )}
                    style={{
                        gridColumn: `${segment.start + 1} / span ${segment.length}`,
                    }}
                />
            ))}
        </div>
    );
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

    if (
        day.status === "operational" ||
        day.status === "maintenance_completed"
    ) {
        segments.uptime = 100;
    } else if (day.status === "unknown") {
        segments.unknown = 100;
        segments.uptime = 0;
    } else {
        const downtimeMs = isMaintenanceStatus(day.status)
            ? (day.maintenanceMs ?? parseDuration(day.duration))
            : (day.downtimeMs ?? parseDuration(day.duration));
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
                    className={cn(
                        "w-full transition-opacity",
                        segmentColors.uptime,
                    )}
                    style={{ height: `${uptime}%` }}
                />
            )}
            {unknown > 0 && (
                <div
                    className={cn(
                        "w-full transition-opacity",
                        segmentColors.unknown,
                    )}
                    style={{ height: `${unknown}%` }}
                />
            )}
            {minor > 0 && (
                <div
                    className={cn(
                        "w-full transition-opacity",
                        segmentColors.minor,
                    )}
                    style={{ height: `${minor}%` }}
                />
            )}
            {major > 0 && (
                <div
                    className={cn(
                        "w-full transition-opacity",
                        segmentColors.major,
                    )}
                    style={{ height: `${major}%` }}
                />
            )}
            {critical > 0 && (
                <div
                    className={cn(
                        "w-full transition-opacity",
                        segmentColors.critical,
                    )}
                    style={{ height: `${critical}%` }}
                />
            )}
            {maintenance > 0 && (
                <div
                    className={cn(
                        "w-full transition-opacity",
                        segmentColors.maintenance,
                    )}
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
    toFixed = 2,
}: UptimeBarProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [tooltipPosition, setTooltipPosition] =
        useState<ViewportTooltipPosition | null>(null);
    const segments = buildSegments(days);
    const hoveredDay = hoveredIndex !== null ? days[hoveredIndex] : null;
    const hoveredSegments =
        style === "length" && hoveredDay ? calculateSegments(hoveredDay) : null;
    const showHoveredUptimeSegment =
        hoveredDay &&
        hoveredSegments &&
        !isMaintenanceStatus(hoveredDay.status) &&
        hoveredSegments.uptime > 0 &&
        hoveredSegments.uptime < 100;
    const compactGapClassName =
        days.length <= 30
            ? "gap-[3px]"
            : days.length <= 60
              ? "gap-[2px]"
              : "gap-px";
    const handleDayMouseEnter = (
        index: number,
        event: MouseEvent<HTMLDivElement>,
    ) => {
        setHoveredIndex(index);
        setTooltipPosition(getViewportTooltipPosition(event.currentTarget));
    };

    const handleDayMouseLeave = () => {
        setHoveredIndex(null);
        setTooltipPosition(null);
    };

    return (
        <LazyMotion features={domAnimation}>
            <div className={cn("relative", className)}>
                {style === "signal" ? (
                    <>
                        <div className="mb-3 flex items-center justify-between px-0.5 text-muted-foreground text-sm leading-[1.2] min-[600px]:text-base">
                            <span className="font-medium">
                                {days.length} days ago
                            </span>
                            <span className="font-[450]">Today</span>
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
                                onMouseLeave={handleDayMouseLeave}
                            >
                                {days.map((day, index) => (
                                    // biome-ignore lint/a11y/noStaticElementInteractions: visual hover target
                                    <div
                                        key={day.date}
                                        className="relative h-full"
                                        onMouseEnter={(event) =>
                                            handleDayMouseEnter(index, event)
                                        }
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
                    <div
                        className={cn("flex h-10 w-full", compactGapClassName)}
                    >
                        {days.map((day, index) => (
                            // biome-ignore lint/a11y/noStaticElementInteractions: visual hover target
                            <div
                                key={day.date}
                                className="group relative flex-1 first:rounded-l-md last:rounded-r-md"
                                onMouseEnter={(event) =>
                                    handleDayMouseEnter(index, event)
                                }
                                onMouseLeave={handleDayMouseLeave}
                            >
                                {style === "length" ? (
                                    <div className="h-full w-full rounded-[2px] transition-opacity hover:opacity-80">
                                        <StackedBar
                                            segments={calculateSegments(day)}
                                        />
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
                    {hoveredDay && tooltipPosition ? (
                        <ViewportTooltip position={tooltipPosition}>
                            <m.div
                                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                                animate={{
                                    opacity: 1,
                                    y: 0,
                                    scale: 1,
                                }}
                                exit={{ opacity: 0, y: 4, scale: 0.985 }}
                                transition={{
                                    opacity: {
                                        duration: 0.14,
                                        ease: [0.2, 0, 0, 1],
                                    },
                                    y: { duration: 0.14, ease: [0.2, 0, 0, 1] },
                                    scale: {
                                        duration: 0.14,
                                        ease: [0.2, 0, 0, 1],
                                    },
                                }}
                                className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
                            >
                                <div
                                    className={cn(
                                        "px-4 py-3",
                                        hoveredDay.status === "operational"
                                            ? "bg-status-operational/12 text-status-operational"
                                            : hoveredDay.status === "degraded"
                                              ? "bg-status-degraded/12 text-status-degraded"
                                              : hoveredDay.status ===
                                                  "partial_outage"
                                                ? "bg-status-partial-outage/12 text-status-partial-outage"
                                                : hoveredDay.status ===
                                                    "major_outage"
                                                  ? "bg-status-major-outage/12 text-status-major-outage"
                                                  : hoveredDay.status ===
                                                          "maintenance" ||
                                                      hoveredDay.status ===
                                                          "maintenance_scheduled"
                                                    ? "bg-status-maintenance/12 text-status-maintenance"
                                                    : "bg-muted text-muted-foreground",
                                    )}
                                >
                                    <div className="font-semibold text-[12px]">
                                        {statusConfig[hoveredDay.status].label}
                                    </div>
                                    {isMaintenanceStatus(hoveredDay.status) ? (
                                        <div className="mt-1 text-[12px] opacity-85">
                                            {formatMaintenanceDuration(
                                                hoveredDay,
                                            )}
                                        </div>
                                    ) : hoveredDay.duration ? (
                                        <div className="mt-1 text-[12px] opacity-85">
                                            {hoveredDay.duration}
                                        </div>
                                    ) : hoveredDay.status !== "unknown" ? (
                                        <div className="mt-1 text-[12px] opacity-85">
                                            {hoveredDay.downtimeMs !==
                                                undefined &&
                                            hoveredDay.downtimeMs > 0
                                                ? formatDowntime(
                                                      hoveredDay.downtimeMs,
                                                  )
                                                : "No downtime"}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="min-w-56 bg-card px-4 py-3 font-medium text-[12px] text-foreground">
                                    {new Date(
                                        hoveredDay.date,
                                    ).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                        timeZone: "UTC",
                                    })}
                                </div>
                                {style === "length" ? (
                                    <div className="border-border border-t bg-muted/45 px-4 py-3">
                                        <div className="space-y-1 text-[12px] text-foreground/80">
                                            {showHoveredUptimeSegment ? (
                                                <div>
                                                    {hoveredSegments.uptime.toFixed(
                                                        toFixed,
                                                    )}
                                                    % uptime
                                                </div>
                                            ) : null}
                                            {hoveredSegments &&
                                            hoveredSegments.minor > 0 ? (
                                                <div>
                                                    {hoveredSegments.minor.toFixed(
                                                        toFixed,
                                                    )}
                                                    % minor issues
                                                </div>
                                            ) : null}
                                            {hoveredSegments &&
                                            hoveredSegments.major > 0 ? (
                                                <div>
                                                    {hoveredSegments.major.toFixed(
                                                        toFixed,
                                                    )}
                                                    % major outage
                                                </div>
                                            ) : null}
                                            {hoveredSegments &&
                                            hoveredSegments.critical > 0 ? (
                                                <div>
                                                    {hoveredSegments.critical.toFixed(
                                                        toFixed,
                                                    )}
                                                    % critical outage
                                                </div>
                                            ) : null}
                                            {hoveredSegments &&
                                            hoveredSegments.maintenance > 0 ? (
                                                <div>
                                                    {hoveredSegments.maintenance.toFixed(
                                                        toFixed,
                                                    )}
                                                    % maintenance
                                                </div>
                                            ) : null}
                                            {hoveredSegments &&
                                            hoveredSegments.unknown > 0 ? (
                                                <div>
                                                    {hoveredSegments.unknown.toFixed(
                                                        toFixed,
                                                    )}
                                                    % unknown
                                                </div>
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
                            </m.div>
                        </ViewportTooltip>
                    ) : null}
                </AnimatePresence>
            </div>
        </LazyMotion>
    );
}
