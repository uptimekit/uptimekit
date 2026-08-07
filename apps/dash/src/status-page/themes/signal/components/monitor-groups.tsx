"use client";

import { faChevronDown, faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/status-page/components/ui/tooltip";
import { cn } from "@/status-page/lib/utils";
import type { GroupedMonitors, Monitor } from "../../types";
import { UptimeBar, UptimePreview } from "./uptime-bar";
import { getGroupHistory } from "./utils";

interface MonitorGroupsProps {
    monitorGroups: GroupedMonitors[];
    toFixed?: number;
}

function MonitorCard({
    monitor,
    toFixed,
}: {
    monitor: Monitor;
    toFixed: number;
}) {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className="signal-monitor-card overflow-hidden rounded-t-xl rounded-b-[20px]">
            <button
                type="button"
                onClick={() =>
                    monitor.displayStyle !== "status" &&
                    setIsExpanded((current) => !current)
                }
                className="signal-section-header relative z-20 flex w-full items-start gap-2 overflow-hidden rounded-xl p-3 text-left min-[600px]:gap-3 min-[600px]:px-4"
            >
                <div className="shrink-0">
                    <FontAwesomeIcon
                        icon={faChevronDown}
                        className={cn(
                            "h-3 w-3 text-foreground transition-transform duration-200",
                            !isExpanded && "-rotate-90",
                            monitor.displayStyle === "status" &&
                                "text-transparent",
                        )}
                    />
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate font-[550] text-foreground text-sm leading-[1.2] min-[600px]:text-base">
                            {monitor.name}
                        </span>
                        {monitor.description ? (
                            <Tooltip>
                                <TooltipTrigger
                                    render={
                                        <button
                                            type="button"
                                            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            aria-label="More information"
                                        />
                                    }
                                >
                                    <FontAwesomeIcon
                                        icon={faCircleInfo}
                                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                    />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="max-w-xs text-sm">
                                        {monitor.description}
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        ) : null}
                    </div>
                    <div className="signal-section-secondary flex shrink-0 items-center gap-2 font-[450] text-sm leading-[1.2] min-[600px]:text-base">
                        {!isExpanded || monitor.displayStyle === "status" ? (
                            <UptimePreview days={monitor.history} />
                        ) : null}
                        {monitor.avgUptime.toFixed(toFixed)}% uptime
                    </div>
                </div>
            </button>

            <div
                className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                    isExpanded
                        ? "grid-rows-[1fr] opacity-100"
                        : "pointer-events-none grid-rows-[0fr] opacity-0",
                )}
            >
                <div
                    className={cn(
                        "min-h-0",
                        isExpanded ? "overflow-visible" : "overflow-hidden",
                    )}
                >
                    <div className="px-6 pt-5 pb-6">
                        {monitor.displayStyle !== "status" && (
                            <UptimeBar
                                days={monitor.history}
                                style="signal"
                                toFixed={toFixed}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function MonitorGroups({
    monitorGroups,
    toFixed = 2,
}: MonitorGroupsProps) {
    return (
        <section className="space-y-12">
            {monitorGroups.map((group) => (
                <MonitorGroupSection
                    key={
                        group.group?.id ||
                        `ungrouped-${group.monitors.map((monitor) => monitor.id).join("-") || "empty"}`
                    }
                    group={group}
                    toFixed={toFixed}
                />
            ))}
        </section>
    );
}

function MonitorGroupSection({
    group,
    toFixed,
}: {
    group: GroupedMonitors;
    toFixed: number;
}) {
    const isCollapsible = group.group
        ? group.group.collapsible !== false
        : false;
    const [isExpanded, setIsExpanded] = useState(
        !isCollapsible || !group.group?.defaultCollapsed,
    );
    const groupUptime =
        group.monitors.reduce((sum, monitor) => sum + monitor.avgUptime, 0) /
        Math.max(group.monitors.length, 1);
    const groupHistory = getGroupHistory(group.monitors);

    return (
        <div
            className={cn(
                group.group
                    ? "signal-panel overflow-hidden rounded-t-xl rounded-b-[20px]"
                    : "space-y-3",
            )}
        >
            {group.group && isCollapsible ? (
                <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setIsExpanded((current) => !current)}
                    className="signal-section-header relative z-20 flex w-full items-start gap-2 overflow-hidden rounded-xl p-3 text-left min-[600px]:gap-3 min-[600px]:p-4"
                >
                    <div className="shrink-0 p-1">
                        <FontAwesomeIcon
                            icon={faChevronDown}
                            className={cn(
                                "h-3 w-3 text-foreground transition-transform duration-200",
                                !isExpanded && "-rotate-90",
                            )}
                        />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                        <div className="min-w-0 flex-1 truncate font-[550] text-foreground text-sm leading-[1.2] min-[600px]:text-base">
                            {group.group.name}
                        </div>
                        <div className="signal-section-secondary shrink-0 font-[450] text-sm leading-[1.2] min-[600px]:text-base">
                            {groupUptime.toFixed(toFixed)}% uptime
                        </div>
                    </div>
                </button>
            ) : group.group ? (
                <div className="signal-section-header flex w-full items-center justify-between gap-4 rounded-xl p-3 min-[600px]:p-4">
                    <div className="font-[550] text-foreground text-sm min-[600px]:text-base">
                        {group.group.name}
                    </div>
                    <div className="signal-section-secondary font-[450] text-sm min-[600px]:text-base">
                        {groupUptime.toFixed(toFixed)}% uptime
                    </div>
                </div>
            ) : null}
            <div
                aria-hidden={!isExpanded}
                inert={!isExpanded}
                className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
                    isExpanded
                        ? "grid-rows-[1fr] opacity-100"
                        : "pointer-events-none grid-rows-[0fr] opacity-0",
                )}
            >
                <div
                    className={cn(
                        "signal-group-body min-h-0",
                        isExpanded ? "overflow-visible" : "overflow-hidden",
                    )}
                >
                    {group.group && groupHistory.length > 0 ? (
                        <div className="pt-5 pr-4 pb-6 pl-[52px] min-[600px]:pr-6 min-[600px]:pl-[68px]">
                            <UptimeBar days={groupHistory} style="signal" />
                        </div>
                    ) : null}
                    <div
                        className={cn(
                            group.group &&
                                "signal-monitor-tree ml-9 min-[600px]:ml-11",
                            "space-y-3",
                        )}
                    >
                        {group.monitors.map((monitor) => (
                            <MonitorCard
                                key={monitor.id}
                                monitor={monitor}
                                toFixed={toFixed}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
