"use client";

import { useEffect, useRef, useState } from "react";
import {
    ViewportTooltip,
    type ViewportTooltipPosition,
} from "@/components/viewport-tooltip";
import { calculateAggregateStatus } from "@/lib/status-utils";
import type {
    GroupedMonitors,
    Monitor,
    StatusType,
    UptimeDay,
} from "../../types";

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

function getTooltipMessages(day: UptimeDay): string[] {
    if (
        day.status === "operational" ||
        day.status === "maintenance_completed"
    ) {
        return ["No incidents"];
    }

    if (day.annotation) {
        return day.annotation
            .split(/\n+|\s+\|\s+/)
            .map((message) => message.trim())
            .filter(Boolean);
    }

    return [day.status.replaceAll("_", " ")];
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

function MonitorGroupRow({
    group,
    index,
    toFixed,
}: {
    group: GroupedMonitors;
    index: number;
    toFixed: number;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const history = getGroupHistory(group.monitors);
    const status = calculateAggregateStatus(
        group.monitors.map((monitor) => monitor.currentStatus),
    );
    const name = group.group?.name ?? `Group ${index + 1}`;

    return (
        <div className="spark-group-row" data-open={isOpen}>
            <div className="spark-group-meta">
                <div className="spark-group-title">
                    <span className="spark-status-icon" data-status={status} />
                    <span className="truncate">{name}</span>
                    <button
                        type="button"
                        className="spark-component-count spark-component-toggle"
                        data-open={isOpen}
                        aria-expanded={isOpen}
                        onClick={() => setIsOpen((current) => !current)}
                    >
                        {formatComponentCount(group.monitors.length)}
                        <span className="spark-chevron spark-chevron-down" />
                    </button>
                </div>
                <div className="spark-uptime">
                    {formatUptime(getAverageUptime(group.monitors), toFixed)}%
                    uptime
                </div>
            </div>

            <div className="spark-summary" aria-hidden={isOpen}>
                <div className="spark-summary-inner">
                    {history.length ? (
                        <HistoryBars days={history} toFixed={toFixed} />
                    ) : (
                        <div className="spark-empty-history">No history</div>
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
            className="spark-bars z-99"
            style={{
                gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
            }}
            onMouseLeave={hideTooltip}
        >
            {days.map((day, index) => (
                <button
                    type="button"
                    key={day.date}
                    className="spark-bar"
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
                        className="spark-bar-tooltip"
                        data-visible={tooltip.visible}
                    >
                        <div className="spark-bar-tooltip-date">
                            {formatTooltipDate(hoveredDay.date)}
                        </div>
                        <div className="spark-bar-tooltip-messages">
                            {getTooltipMessages(hoveredDay).map((message) => (
                                <div
                                    key={message}
                                    className="spark-bar-tooltip-message"
                                >
                                    <span
                                        className="spark-tooltip-icon"
                                        data-status={hoveredDay.status}
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
        <div className="spark-component-item">
            <div className="spark-component-meta">
                <div className="spark-component-name">
                    <span
                        className="spark-status-icon"
                        data-status={monitor.currentStatus}
                    />
                    <span className="truncate">{monitor.name}</span>
                    {monitor.description ? (
                        <span
                            className="spark-info"
                            title={monitor.description}
                        >
                            i
                        </span>
                    ) : null}
                </div>
                <span className="spark-component-uptime">
                    {formatUptime(monitor.avgUptime, toFixed)}% uptime
                </span>
            </div>
            {monitor.history.length ? (
                <HistoryBars days={monitor.history} toFixed={toFixed} />
            ) : (
                <div className="spark-empty-history">No history</div>
            )}
        </div>
    );
}

export function MonitorGroups({
    monitorGroups,
    toFixed = 2,
}: MonitorGroupsProps) {
    return (
        <section className="spark-card" aria-label="System status">
            <div className="spark-card-header">
                <h2 className="spark-card-title">System status</h2>
                <div className="spark-period">
                    {/* <span className="spark-chevron spark-chevron-left" /> */}
                    <span>{getPeriodLabel(monitorGroups)}</span>
                    {/* <span className="spark-chevron spark-chevron-right" /> */}
                </div>
            </div>

            {monitorGroups.map((group, index) => (
                <MonitorGroupRow
                    key={group.group?.id ?? `ungrouped-${index}`}
                    group={group}
                    index={index}
                    toFixed={toFixed}
                />
            ))}
        </section>
    );
}
