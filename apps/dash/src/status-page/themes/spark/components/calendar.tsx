"use client";

import { faWrench } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/status-page/components/ui/tooltip";
import { calculateAggregateStatus } from "@/status-page/lib/status-utils";
import { cn } from "@/status-page/lib/utils";
import type { GroupedMonitors, StatusType } from "../../types";

const weekdays = [
    { key: "mon", label: "M" },
    { key: "tue", label: "T" },
    { key: "wed", label: "W" },
    { key: "thu", label: "T" },
    { key: "fri", label: "F" },
    { key: "sat", label: "S" },
    { key: "sun", label: "S" },
];

const calendarStatusClass: Record<StatusType, string> = {
    operational: "border-status-operational text-status-operational",
    degraded: "border-status-degraded text-status-degraded",
    partial_outage: "border-status-partial-outage text-status-partial-outage",
    major_outage: "border-status-major-outage text-status-major-outage",
    maintenance: "border-status-maintenance text-status-maintenance",
    maintenance_scheduled: "border-status-maintenance text-status-maintenance",
    maintenance_completed: "border-status-operational text-status-operational",
    unknown: "border-status-unknown text-status-unknown",
};

interface CalendarProps {
    lastUpdated: string;
    monitorGroups: GroupedMonitors[];
}

interface CalendarEvent {
    title: string;
    status: StatusType;
}

function getUtcDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function getCalendarEvents(monitorGroups: GroupedMonitors[]) {
    const events = new Map<string, CalendarEvent[]>();

    for (const group of monitorGroups) {
        for (const monitor of group.monitors) {
            for (const day of monitor.history) {
                if (!day.annotation) continue;

                const currentEvents = events.get(day.date) ?? [];

                for (const title of splitAnnotations(day.annotation)) {
                    const existingEvent = currentEvents.find(
                        (event) => event.title === title,
                    );

                    if (existingEvent) {
                        existingEvent.status = calculateAggregateStatus([
                            existingEvent.status,
                            day.status,
                        ]);
                        continue;
                    }

                    currentEvents.push({ title, status: day.status });
                }

                events.set(day.date, currentEvents);
            }
        }
    }

    return events;
}

function splitAnnotations(annotation: string): string[] {
    return annotation.split(/\n+|\s+\|\s+/).flatMap((message) => {
        const trimmedMessage = message.trim();
        return trimmedMessage ? [trimmedMessage] : [];
    });
}

function getCalendarStatus(events: CalendarEvent[]): StatusType | undefined {
    if (events.length === 0) return undefined;

    return calculateAggregateStatus(events.map((event) => event.status));
}

function getMonthCells(monthDate: Date) {
    const year = monthDate.getUTCFullYear();
    const month = monthDate.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const leadingBlanks =
        (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
    const cellCount = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;

    return Array.from({ length: cellCount }, (_, index) => {
        const day = index - leadingBlanks + 1;

        return day > 0 && day <= daysInMonth
            ? { key: `day-${day}`, day }
            : { key: `blank-${index}`, day: null };
    });
}

function formatMonthYear(date: Date): string {
    return date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    });
}

function formatTooltipDate(dateKey: string): string {
    return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    });
}

function getInitialMonth(lastUpdated: string): Date {
    const date = new Date(lastUpdated);
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

    return new Date(
        Date.UTC(safeDate.getUTCFullYear(), safeDate.getUTCMonth(), 1),
    );
}

function addMonths(date: Date, months: number): Date {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
    );
}

function getMonthValue(date: Date): number {
    return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function CalendarEventIcon({ status }: { status: StatusType }) {
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

function CalendarTooltipContent({
    dateKey,
    events,
}: {
    dateKey: string;
    events: CalendarEvent[];
}) {
    return (
        <div className="w-full p-1 text-left">
            <div className="mb-3.5 text-muted-foreground text-sm">
                {formatTooltipDate(dateKey)}
            </div>
            <div className="grid gap-3">
                {events.map((event) => (
                    <div
                        key={`${event.status}-${event.title}`}
                        className="flex items-start gap-2.5 font-medium text-foreground text-sm leading-[1.35]"
                    >
                        <CalendarEventIcon status={event.status} />
                        <span>{event.title}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function CalendarDay({
    dateKey,
    day,
    events,
}: {
    dateKey: string;
    day: number;
    events: CalendarEvent[];
}) {
    const status = getCalendarStatus(events);
    const className = cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-full border border-transparent bg-transparent text-xs",
        status && calendarStatusClass[status],
    );

    if (events.length === 0) {
        return <span className={className}>{day}</span>;
    }

    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <button
                        type="button"
                        className={className}
                        aria-label={`${formatTooltipDate(dateKey)}: ${events.length} event${events.length === 1 ? "" : "s"}`}
                    />
                }
            >
                {day}
            </TooltipTrigger>
            <TooltipContent
                align="center"
                side="bottom"
                sideOffset={0}
                className="border-border bg-card shadow-[0_10px_24px_rgb(0_0_0/0.24)]"
            >
                <CalendarTooltipContent dateKey={dateKey} events={events} />
            </TooltipContent>
        </Tooltip>
    );
}

export function Calendar({ lastUpdated, monitorGroups }: CalendarProps) {
    const latestMonth = getInitialMonth(lastUpdated);
    const [visibleMonth, setVisibleMonth] = useState(() => latestMonth);
    const cells = getMonthCells(visibleMonth);
    const events = getCalendarEvents(monitorGroups);
    const year = visibleMonth.getUTCFullYear();
    const month = visibleMonth.getUTCMonth();
    const canGoNext = getMonthValue(visibleMonth) < getMonthValue(latestMonth);

    return (
        <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex min-h-[52px] items-center gap-3 border-border border-b px-4">
                <h2 className="font-semibold text-base">Calendar</h2>
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <button
                        type="button"
                        className="inline-flex h-6 w-5 items-center justify-center"
                        aria-label="Previous month"
                        onClick={() =>
                            setVisibleMonth((current) => addMonths(current, -1))
                        }
                    >
                        <span className="spark-chevron spark-chevron-left" />
                    </button>
                    <span>{formatMonthYear(visibleMonth)}</span>
                    <button
                        type="button"
                        className={cn(
                            "inline-flex h-6 w-5 items-center justify-center",
                            !canGoNext && "cursor-not-allowed opacity-35",
                        )}
                        aria-label="Next month"
                        disabled={!canGoNext}
                        onClick={() =>
                            setVisibleMonth((current) =>
                                canGoNext ? addMonths(current, 1) : current,
                            )
                        }
                    >
                        <span className="spark-chevron spark-chevron-right" />
                    </button>
                </div>
            </div>
            <div className="grid h-10 grid-cols-7 items-center px-4 text-center text-muted-foreground text-xs">
                {weekdays.map((day) => (
                    <div key={day.key}>{day.label}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 border-border border-t">
                {cells.map(({ key, day }) => {
                    const dateKey =
                        day !== null
                            ? getUtcDateKey(
                                  new Date(Date.UTC(year, month, day)),
                              )
                            : null;
                    const dayEvents = dateKey
                        ? (events.get(dateKey) ?? [])
                        : [];

                    return (
                        <div
                            key={key}
                            className="flex h-10 items-center justify-center border-border border-r border-b text-muted-foreground text-xs [&:nth-child(7n)]:border-r-0"
                        >
                            {day !== null && dateKey ? (
                                <CalendarDay
                                    dateKey={dateKey}
                                    day={day}
                                    events={dayEvents}
                                />
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
