"use client";

import {
    faCheck,
    faExclamation,
    faQuestion,
    faWrench,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState } from "react";
import { ViewportTooltip } from "@/components/viewport-tooltip";
import type { ViewportTooltipPosition } from "@/components/viewport-tooltip-position";
import { calculateAggregateStatus } from "@/lib/status-utils";
import { cn } from "@/lib/utils";
import type {
    GroupedMonitors,
    Monitor,
    StatusType,
    UptimeDay,
} from "../../types";

const statusBgClass: Record<StatusType, string> = {
    operational: "bg-status-operational",
    degraded: "bg-status-degraded",
    partial_outage: "bg-status-partial-outage",
    major_outage: "bg-status-major-outage",
    maintenance: "bg-status-maintenance",
    maintenance_scheduled: "bg-status-partial-outage",
    maintenance_completed: "bg-status-operational",
    unknown: "bg-status-unknown",
};

const statusIcon = {
    operational: faCheck,
    degraded: faExclamation,
    partial_outage: faExclamation,
    major_outage: faXmark,
    maintenance: faWrench,
    maintenance_scheduled: faWrench,
    maintenance_completed: faCheck,
    unknown: faQuestion,
} as const;

interface MonitorGroupsProps {
    monitorGroups: GroupedMonitors[];
    toFixed?: number;
}

interface GroupHistoryDay extends UptimeDay {
    status: StatusType;
}

function formatUptime(uptime: number, toFixed: number): string {
    return uptime
        .toFixed(toFixed)
        .replace(/\.0+$/, "")
        .replace(/(\.\d*?)0+$/, "$1");
}

function formatComponentCount(count: number): string {
    return `${count} ${count === 1 ? "component" : "components"}`;
}

function getGroupKey(group: GroupedMonitors): string {
    if (group.group?.id) return group.group.id;

    const monitorIds = group.monitors
        .map((monitor) => monitor.id)
        .sort()
        .join("-");

    return `ungrouped-${monitorIds || "empty"}`;
}

function getAverageUptime(monitors: Monitor[]): number {
    if (monitors.length === 0) return 0;

    return (
        monitors.reduce((total, monitor) => total + monitor.avgUptime, 0) /
        monitors.length
    );
}

function getGroupHistory(monitors: Monitor[]): GroupHistoryDay[] {
    const days = monitors[0]?.history ?? [];

    return days.map((day, index) => {
        const annotations = monitors
            .map((monitor) => monitor.history[index]?.annotation)
            .filter((annotation): annotation is string => Boolean(annotation));

        return {
            ...day,
            uptime:
                monitors.reduce(
                    (total, monitor) =>
                        total +
                        (monitor.history[index]?.uptime ?? monitor.avgUptime),
                    0,
                ) / Math.max(monitors.length, 1),
            status: calculateAggregateStatus(
                monitors.map(
                    (monitor) =>
                        monitor.history[index]?.status ?? monitor.currentStatus,
                ),
            ),
            annotation: Array.from(new Set(annotations)).join("\n"),
        };
    });
}

function formatMonthYear(date: string): string {
    return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    });
}

function formatTooltipDate(date: string): string {
    return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    });
}

function formatStatusText(status: StatusType): string {
    const text = status.replaceAll("_", " ");

    return text.charAt(0).toUpperCase() + text.slice(1);
}

function getTooltipMessages(day: UptimeDay): string[] {
    if (
        day.status === "operational" ||
        day.status === "maintenance_completed"
    ) {
        return ["No incidents"];
    }

    if (day.annotation) {
        return day.annotation.split(/\n+|\s+\|\s+/).flatMap((message) => {
            const trimmedMessage = message.trim();
            return trimmedMessage ? [trimmedMessage] : [];
        });
    }

    return [formatStatusText(day.status)];
}

function getBelowTooltipPosition(
    element: HTMLElement,
): ViewportTooltipPosition {
    const rect = element.getBoundingClientRect();

    return {
        left: rect.left + rect.width / 2,
        top: rect.bottom + 8,
    };
}

function getPeriodLabel(monitorGroups: GroupedMonitors[]): string {
    const history = monitorGroups.find(
        (group) => group.monitors[0]?.history.length,
    )?.monitors[0]?.history;

    if (!history?.length) return "Current period";

    return `${formatMonthYear(history[0].date)} - ${formatMonthYear(history[history.length - 1].date)}`;
}

function StatusIcon({
    status,
    className,
}: {
    status: StatusType;
    className?: string;
}) {
    return (
        <span
            className={cn(
                "spark-status-icon relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                statusBgClass[status],
                className,
            )}
            data-status={status}
        >
            <FontAwesomeIcon
                aria-hidden="true"
                icon={statusIcon[status]}
                className="h-2.5 max-h-2.5 w-2.5 max-w-2.5 text-background"
            />
        </span>
    );
}

function TooltipStatusIcon({ status }: { status: StatusType }) {
    if (status === "maintenance" || status === "maintenance_scheduled") {
        return (
            <FontAwesomeIcon
                icon={faWrench}
                className="mt-0.5 h-[15px] w-[15px] shrink-0 text-status-maintenance"
            />
        );
    }

    return <span className="spark-tooltip-icon" data-status={status} />;
}

function HistoryBars({
    days,
    toFixed,
}: {
    days: UptimeDay[];
    toFixed: number;
}) {
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [tooltip, setTooltip] = useState<{
        index: number;
        position: ViewportTooltipPosition;
        visible: boolean;
    } | null>(null);
    const hoveredDay = tooltip ? days[tooltip.index] : null;

    useEffect(() => {
        return () => {
            if (hideTimer.current) clearTimeout(hideTimer.current);
        };
    }, []);

    const showTooltip = (index: number, element: HTMLElement) => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        const position = getBelowTooltipPosition(element);

        if (tooltip) {
            setTooltip({ index, position, visible: true });
            return;
        }

        setTooltip({ index, position, visible: false });
        requestAnimationFrame(() => {
            setTooltip((current) =>
                current ? { ...current, visible: true } : null,
            );
        });
    };

    const hideTooltip = () => {
        setTooltip((current) =>
            current ? { ...current, visible: false } : null,
        );
        hideTimer.current = setTimeout(() => setTooltip(null), 140);
    };

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: visual hover target
        <div
            className="relative z-[99] grid h-4 gap-[3px] max-[520px]:gap-px"
            style={{
                gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
            }}
            onMouseLeave={hideTooltip}
        >
            {days.map((day, index) => (
                <button
                    type="button"
                    key={day.date}
                    className={cn(
                        "min-w-px cursor-default rounded-[1px] border-0 p-0",
                        statusBgClass[day.status],
                    )}
                    data-status={day.status}
                    aria-label={`${day.date}: ${formatUptime(day.uptime, toFixed)}% uptime`}
                    onMouseEnter={(event) =>
                        showTooltip(index, event.currentTarget)
                    }
                    onFocus={(event) => showTooltip(index, event.currentTarget)}
                    onBlur={hideTooltip}
                />
            ))}
            {tooltip && hoveredDay ? (
                <ViewportTooltip
                    className="translate-y-0"
                    edgePadding="1rem"
                    position={tooltip.position}
                >
                    <div
                        className={cn(
                            "pointer-events-none w-64 rounded-md border border-border bg-card p-2.5 shadow-[0_10px_24px_rgb(0_0_0/0.24)] transition-[opacity,transform] duration-[140ms] ease-out",
                            tooltip.visible
                                ? "translate-y-0 opacity-100"
                                : "-translate-y-1 opacity-0",
                        )}
                    >
                        <div className="mb-3.5 text-muted-foreground text-sm">
                            {formatTooltipDate(hoveredDay.date)}
                        </div>
                        <div className="grid gap-3.5">
                            {getTooltipMessages(hoveredDay).map((message) => (
                                <div
                                    key={message}
                                    className="flex items-start gap-2.5 font-medium text-foreground text-sm leading-[1.35]"
                                >
                                    <TooltipStatusIcon
                                        status={hoveredDay.status}
                                    />
                                    <span>{message}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </ViewportTooltip>
            ) : null}
        </div>
    );
}

function MonitorComponentRow({
    monitor,
    toFixed,
}: {
    monitor: Monitor;
    toFixed: number;
}) {
    return (
        <div className="pt-2 [&:not(:first-child)]:pt-3.5">
            <div className="mb-2 flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-[7px] font-medium text-sm">
                    <StatusIcon status={monitor.currentStatus} />
                    <span className="truncate">{monitor.name}</span>
                    {monitor.description ? (
                        <span
                            className="inline-flex h-[13px] w-[13px] select-none items-center justify-center rounded-full border border-muted-foreground text-[9px] text-muted-foreground leading-none"
                            title={monitor.description}
                        >
                            i
                        </span>
                    ) : null}
                </div>
                <span className="shrink-0 text-muted-foreground text-sm">
                    {formatUptime(monitor.avgUptime, toFixed)}% uptime
                </span>
            </div>
            {monitor.history.length ? (
                <HistoryBars days={monitor.history} toFixed={toFixed} />
            ) : (
                <div className="text-muted-foreground text-sm">No history</div>
            )}
        </div>
    );
}

function MonitorGroupRow({
    group,
    index,
    toFixed,
}: {
    group: GroupedMonitors;
    index: number;
    toFixed: number;
}) {
    const isCollapsible = group.group?.collapsible !== false;
    const [isOpen, setIsOpen] = useState(
        !isCollapsible || !group.group?.defaultCollapsed,
    );
    const history = getGroupHistory(group.monitors);
    const status = calculateAggregateStatus(
        group.monitors.map((monitor) => monitor.currentStatus),
    );
    const name = group.group?.name ?? `Group ${index + 1}`;

    return (
        <div
            className="spark-group-row border-border border-b px-4 py-4 last:border-b-0"
            data-open={isOpen}
        >
            <div className="mb-2.5 flex items-center justify-between gap-4 max-[520px]:flex-col max-[520px]:items-start max-[520px]:gap-2">
                <div className="flex min-w-0 items-center gap-2 font-medium text-sm">
                    <StatusIcon
                        status={status}
                        className={isOpen ? "hidden" : undefined}
                    />
                    <span className="truncate">{name}</span>
                    <button
                        type="button"
                        className="spark-component-toggle flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-0 bg-transparent p-0 font-inherit text-muted-foreground text-sm hover:text-foreground"
                        data-open={isOpen}
                        aria-expanded={isOpen}
                        disabled={!isCollapsible}
                        onClick={() => setIsOpen((current) => !current)}
                    >
                        {formatComponentCount(group.monitors.length)}
                        <span className="spark-chevron spark-chevron-down" />
                    </button>
                </div>
                <div
                    className={cn(
                        "whitespace-nowrap text-muted-foreground text-sm transition-opacity duration-160",
                        isOpen && "hidden",
                    )}
                >
                    {formatUptime(getAverageUptime(group.monitors), toFixed)}%
                    uptime
                </div>
            </div>

            <div className="spark-summary" aria-hidden={isOpen}>
                <div className="spark-summary-inner">
                    {history.length ? (
                        <HistoryBars days={history} toFixed={toFixed} />
                    ) : (
                        <div className="text-muted-foreground text-sm">
                            No history
                        </div>
                    )}
                </div>
            </div>

            <div
                className="spark-component-panel"
                data-open={isOpen}
                aria-hidden={!isOpen}
            >
                <div className="spark-component-panel-inner">
                    {group.monitors.map((monitor) => (
                        <MonitorComponentRow
                            key={monitor.id}
                            monitor={monitor}
                            toFixed={toFixed}
                        />
                    ))}
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
        <section
            className="overflow-hidden rounded-lg border border-border bg-card"
            aria-label="System status"
        >
            <div className="flex min-h-[52px] items-center gap-[22px] border-border border-b px-4 max-[520px]:flex-col max-[520px]:items-start max-[520px]:gap-2">
                <h2 className="font-semibold text-base">System status</h2>
                <div className="flex items-center gap-2.5 text-muted-foreground text-sm">
                    <span>{getPeriodLabel(monitorGroups)}</span>
                </div>
            </div>

            {monitorGroups.map((group, index) => (
                <MonitorGroupRow
                    key={getGroupKey(group)}
                    group={group}
                    index={index}
                    toFixed={toFixed}
                />
            ))}
        </section>
    );
}
