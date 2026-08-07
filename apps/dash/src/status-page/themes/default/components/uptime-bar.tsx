"use client";

import { type MouseEvent, useState } from "react";
import { ViewportTooltip } from "@/status-page/components/viewport-tooltip";
import {
    getViewportTooltipPosition,
    type ViewportTooltipPosition,
} from "@/status-page/components/viewport-tooltip-position";
import {
    type BarSegments,
    buildUptimeSegments,
    calculateBarSegments,
    formatDowntime,
    formatMaintenanceDuration,
    formatTooltipDate,
    isMaintenanceStatus,
} from "@/status-page/lib/uptime";
import { cn } from "@/status-page/lib/utils";
import { statusConfig } from "../../status-config";
import type { StatusType, UptimeDay } from "../../types";

interface UptimeBarProps {
    days: UptimeDay[];
    className?: string;
    style?: "normal" | "length" | "signal";
    toFixed?: number;
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

function SegmentTooltip({ day, toFixed }: { day: UptimeDay; toFixed: number }) {
    const segs = calculateBarSegments(day);
    const showUptimeSegment =
        !isMaintenanceStatus(day.status) &&
        segs.uptime > 0 &&
        segs.uptime < 100;

    return (
        <div className="mt-2 space-y-1 border-t pt-2">
            {showUptimeSegment && (
                <div className="flex items-center gap-2 text-xs">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-muted-foreground">
                        {segs.uptime.toFixed(toFixed)}% uptime
                    </span>
                </div>
            )}
            {segs.minor > 0 && (
                <div className="flex items-center gap-2 text-xs">
                    <div className="h-2 w-2 rounded-full bg-yellow-500" />
                    <span className="text-muted-foreground">
                        {segs.minor.toFixed(toFixed)}% minor issues
                    </span>
                </div>
            )}
            {segs.major > 0 && (
                <div className="flex items-center gap-2 text-xs">
                    <div className="h-2 w-2 rounded-full bg-orange-500" />
                    <span className="text-muted-foreground">
                        {segs.major.toFixed(toFixed)}% major outage
                    </span>
                </div>
            )}
            {segs.critical > 0 && (
                <div className="flex items-center gap-2 text-xs">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="text-muted-foreground">
                        {segs.critical.toFixed(toFixed)}% critical outage
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
                    className={cn(
                        "w-full transition-opacity",
                        segmentColors.uptime,
                    )}
                    style={{ height: `${uptime}%` }}
                />
            )}
            {/* Unknown status - gray */}
            {unknown > 0 && (
                <div
                    className={cn(
                        "w-full transition-opacity",
                        segmentColors.unknown,
                    )}
                    style={{ height: `${unknown}%` }}
                />
            )}
            {/* Minor issues */}
            {minor > 0 && (
                <div
                    className={cn(
                        "w-full transition-opacity",
                        segmentColors.minor,
                    )}
                    style={{ height: `${minor}%` }}
                />
            )}
            {/* Major issues */}
            {major > 0 && (
                <div
                    className={cn(
                        "w-full transition-opacity",
                        segmentColors.major,
                    )}
                    style={{ height: `${major}%` }}
                />
            )}
            {/* Critical issues */}
            {critical > 0 && (
                <div
                    className={cn(
                        "w-full transition-opacity",
                        segmentColors.critical,
                    )}
                    style={{ height: `${critical}%` }}
                />
            )}
            {/* Maintenance */}
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
    const segments = buildUptimeSegments(days);

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
        <div className={cn("relative w-full", className)}>
            {style === "signal" ? (
                <>
                    <div className="mb-3 flex select-none justify-between text-muted-foreground/60 text-xs">
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
                                // biome-ignore lint/a11y/noStaticElementInteractions: hover-only tooltip target
                                <div
                                    key={day.date}
                                    className="relative h-full"
                                    onMouseEnter={(event) =>
                                        handleDayMouseEnter(index, event)
                                    }
                                    onMouseLeave={handleDayMouseLeave}
                                >
                                    {hoveredIndex === index ? (
                                        <div className="pointer-events-none absolute inset-x-0 top-3 bottom-0">
                                            <div className="h-1.5 w-full rounded-full bg-black/16 dark:bg-white/18" />
                                        </div>
                                    ) : null}
                                    {hoveredIndex === index &&
                                    tooltipPosition ? (
                                        <ViewportTooltip
                                            position={tooltipPosition}
                                        >
                                            <div className="fade-in zoom-in-95 relative max-w-64 animate-in rounded-lg border border-border bg-popover px-3 py-2 shadow-xl transition-[opacity,transform] duration-200">
                                                <div className="font-semibold text-popover-foreground text-sm">
                                                    {day.annotation ||
                                                        statusConfig[day.status]
                                                            .label}
                                                </div>
                                                <div className="mt-1 text-muted-foreground text-xs">
                                                    {formatTooltipDate(
                                                        day.date,
                                                    )}
                                                </div>
                                                {isMaintenanceStatus(
                                                    day.status,
                                                ) ? (
                                                    <div className="mt-1 text-muted-foreground text-xs">
                                                        {formatMaintenanceDuration(
                                                            day,
                                                        )}
                                                    </div>
                                                ) : day.duration ? (
                                                    <div className="mt-1 text-muted-foreground text-xs">
                                                        Duration: {day.duration}
                                                    </div>
                                                ) : (
                                                    day.status !==
                                                        "unknown" && (
                                                        <div className="mt-1 text-muted-foreground text-xs">
                                                            {day.downtimeMs !==
                                                                undefined &&
                                                            day.downtimeMs > 0
                                                                ? formatDowntime(
                                                                      day.downtimeMs,
                                                                  )
                                                                : "No downtime"}
                                                        </div>
                                                    )
                                                )}
                                                <div className="absolute top-full left-1/2 -ml-2 h-0 w-0 border-8 border-transparent border-t-popover" />
                                            </div>
                                        </ViewportTooltip>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {/* Flex container for the bar segments */}
                    <div className="flex h-8 w-full gap-[3px]">
                        {days.map((day, index) => (
                            <>
                                {/* biome-ignore lint/a11y/noStaticElementInteractions: hover-only tooltip target */}
                                <div
                                    key={day.date}
                                    className="group relative flex-1 first:rounded-l-sm last:rounded-r-sm"
                                    onMouseEnter={(event) =>
                                        handleDayMouseEnter(index, event)
                                    }
                                    onMouseLeave={handleDayMouseLeave}
                                >
                                    {/* The visible bar segment */}
                                    {style === "length" ? (
                                        <div className="h-full w-full rounded-[1px] transition-opacity hover:opacity-80">
                                            <StackedBar
                                                segments={calculateBarSegments(
                                                    day,
                                                )}
                                            />
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
                                    {hoveredIndex === index &&
                                        tooltipPosition && (
                                            <ViewportTooltip
                                                position={tooltipPosition}
                                            >
                                                <div className="fade-in zoom-in-95 relative max-w-64 animate-in rounded-lg border border-border bg-popover px-3 py-2 shadow-xl transition-[opacity,transform] duration-200">
                                                    <div className="font-semibold text-popover-foreground text-sm">
                                                        {day.annotation ||
                                                            statusConfig[
                                                                day.status
                                                            ].label}
                                                    </div>
                                                    <div className="mt-1 text-muted-foreground text-xs">
                                                        {formatTooltipDate(
                                                            day.date,
                                                        )}
                                                    </div>
                                                    {style === "length" && (
                                                        <SegmentTooltip
                                                            day={day}
                                                            toFixed={toFixed}
                                                        />
                                                    )}
                                                    {isMaintenanceStatus(
                                                        day.status,
                                                    ) ? (
                                                        <div className="mt-1 text-muted-foreground text-xs">
                                                            {formatMaintenanceDuration(
                                                                day,
                                                            )}
                                                        </div>
                                                    ) : day.duration ? (
                                                        <div className="mt-1 text-muted-foreground text-xs">
                                                            Duration:{" "}
                                                            {day.duration}
                                                        </div>
                                                    ) : (
                                                        day.status !==
                                                            "unknown" && (
                                                            <div className="mt-1 text-muted-foreground text-xs">
                                                                {day.downtimeMs !==
                                                                    undefined &&
                                                                day.downtimeMs >
                                                                    0
                                                                    ? formatDowntime(
                                                                          day.downtimeMs,
                                                                      )
                                                                    : "No downtime"}
                                                            </div>
                                                        )
                                                    )}

                                                    {/* Arrow */}
                                                    <div className="absolute top-full left-1/2 -ml-2 h-0 w-0 border-8 border-transparent border-t-popover" />
                                                </div>
                                            </ViewportTooltip>
                                        )}
                                </div>
                            </>
                        ))}
                    </div>
                </>
            )}

            {/* Legend / Labels */}
            {style !== "signal" ? (
                <div className="mt-2 flex select-none justify-between text-muted-foreground/60 text-xs">
                    <span>{days.length} days ago</span>
                    <div className="mx-4 my-auto hidden h-px flex-1 bg-border/30 sm:block" />
                    <span>Today</span>
                </div>
            ) : null}
        </div>
    );
}
