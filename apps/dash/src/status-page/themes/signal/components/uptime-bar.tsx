"use client";

import { AnimatePresence, domAnimation, LazyMotion, m } from "motion/react";
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

export function UptimePreview({ days }: { days: UptimeDay[] }) {
    const previewDays = days.slice(-14);
    const segments = buildUptimeSegments(previewDays);

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
    const segments = buildUptimeSegments(days);
    const hoveredDay = hoveredIndex !== null ? days[hoveredIndex] : null;
    const hoveredSegments =
        style === "length" && hoveredDay
            ? calculateBarSegments(hoveredDay)
            : null;
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
                                            segments={calculateBarSegments(day)}
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
