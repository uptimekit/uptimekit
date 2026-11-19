"use client";

import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type React from "react";
import { useState } from "react";
import {
    getSectionStatus,
    getSectionStatusText,
} from "@/status-page/lib/section-status";
import { cn } from "@/status-page/lib/utils";
import type { GroupedMonitors } from "../../types";
import { MonitorListItem } from "./monitor-list-item";
import { StatusDot } from "./status-indicator";

interface MonitorGroupsProps {
    monitorGroups: GroupedMonitors[];
    layout?: "vertical" | "horizontal";
    barStyle?: "normal" | "length" | "signal";
    toFixed?: number;
}

export function MonitorGroups({
    monitorGroups,
    layout = "vertical",
    barStyle = "normal",
    toFixed = 2,
}: MonitorGroupsProps): React.JSX.Element {
    const isGrid = layout === "horizontal";

    return (
        <section className="mb-12 space-y-6">
            {monitorGroups.map((group) => (
                <MonitorGroupSection
                    key={group.group?.id || "ungrouped"}
                    group={group}
                    isGrid={isGrid}
                    barStyle={barStyle}
                    toFixed={toFixed}
                />
            ))}
        </section>
    );
}

function MonitorGroupSection({
    group,
    isGrid,
    barStyle,
    toFixed,
}: {
    group: GroupedMonitors;
    isGrid: boolean;
    barStyle: "normal" | "length" | "signal";
    toFixed: number;
}) {
    const isCollapsible = group.group
        ? group.group.collapsible !== false
        : false;
    const [isExpanded, setIsExpanded] = useState(
        !isCollapsible || !group.group?.defaultCollapsed,
    );
    const sectionStatus = getSectionStatus(group.monitors);
    const statusText = getSectionStatusText(
        sectionStatus,
        group.monitors.length,
    );

    return (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            {group.group ? (
                isCollapsible ? (
                    <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => setIsExpanded((current) => !current)}
                        className={cn(
                            "flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-3.5 text-left transition-colors hover:bg-muted/40",
                            isExpanded && "border-border border-b",
                        )}
                    >
                        <div className="flex min-w-0 items-center gap-2.5">
                            <FontAwesomeIcon
                                icon={faChevronDown}
                                className={cn(
                                    "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                                    !isExpanded && "-rotate-90",
                                )}
                            />
                            <h3 className="truncate font-semibold text-base text-foreground">
                                {group.group.name}
                            </h3>
                            <span className="rounded-full border border-border bg-secondary/60 px-2 py-0.2 font-medium text-[11px] text-muted-foreground">
                                {group.monitors.length}
                            </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <span className="hidden text-muted-foreground text-xs sm:inline">
                                {statusText}
                            </span>
                            <StatusDot status={sectionStatus} />
                        </div>
                    </button>
                ) : (
                    <div className="flex items-center justify-between border-border border-b px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                            <h3 className="font-semibold text-base text-foreground">
                                {group.group.name}
                            </h3>
                            <span className="rounded-full border border-border bg-secondary/60 px-2 py-0.2 font-medium text-[11px] text-muted-foreground">
                                {group.monitors.length}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="hidden text-muted-foreground text-xs sm:inline">
                                {statusText}
                            </span>
                            <StatusDot status={sectionStatus} />
                        </div>
                    </div>
                )
            ) : null}
            <div
                className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
                    isExpanded
                        ? "grid-rows-[1fr] opacity-100"
                        : "pointer-events-none grid-rows-[0fr] opacity-0",
                )}
            >
                <div className="min-h-0 overflow-hidden">
                    <div
                        className={cn(
                            isGrid
                                ? "grid grid-cols-1 gap-3 md:grid-cols-2"
                                : "divide-y divide-border/60",
                            group.group ? "px-5 py-3" : "p-5",
                        )}
                    >
                        {group.monitors.map((monitor) => (
                            <MonitorListItem
                                key={monitor.id}
                                name={monitor.name}
                                status={monitor.currentStatus}
                                uptimePercentage={monitor.avgUptime}
                                history={monitor.history}
                                displayStyle={monitor.displayStyle}
                                description={monitor.description}
                                toFixed={toFixed}
                                barStyle={barStyle}
                                variant={isGrid ? "card" : "list"}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
