import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { StatusDot } from "@/components/status-indicator";
import { formatEventDate, getIncidentStatus } from "@/lib/status-event";
import { cn } from "@/lib/utils";
import type { Incident } from "@/themes/types";

interface IncidentCardBaseProps {
    incident: Incident;
    className?: string;
}

type IncidentCardProps = IncidentCardBaseProps &
    (
        | { mode: "link"; href: string }
        | { mode: "expanded"; href?: string }
        | { mode: "accordion"; expanded: boolean; onToggle: () => void }
    );

export function IncidentCard({
    incident,
    className,
    ...display
}: IncidentCardProps) {
    const isExpanded =
        display.mode === "expanded" ||
        (display.mode === "accordion" && display.expanded);
    const href = display.mode === "accordion" ? undefined : display.href;

    return (
        <div
            className={cn(
                "overflow-hidden rounded-xl border border-border bg-card transition-[border-color,background-color] duration-300",
                "hover:border-primary/20",
                className,
            )}
        >
            <div className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-muted/50">
                <div className="flex items-center gap-3">
                    <StatusDot status={getIncidentStatus(incident)} />
                    <div>
                        <h3 className="font-semibold text-card-foreground">
                            {incident.title}
                        </h3>
                        <p className="mt-0.5 text-muted-foreground text-xs">
                            {formatEventDate(incident.startedAt)}
                        </p>
                    </div>
                </div>

                {href ? (
                    <Link
                        href={href as any}
                        aria-label={`View details for ${incident.title}`}
                        className="rounded-full p-2 transition-colors hover:bg-muted"
                    >
                        <FontAwesomeIcon
                            icon={faChevronDown}
                            className="h-5 w-5 -rotate-90 text-muted-foreground"
                        />
                    </Link>
                ) : display.mode === "accordion" ? (
                    <button
                        type="button"
                        aria-label={
                            display.expanded
                                ? "Collapse incident"
                                : "Expand incident"
                        }
                        onClick={display.onToggle}
                        className="rounded-full p-2 transition-colors hover:bg-muted"
                    >
                        {display.expanded ? (
                            <FontAwesomeIcon
                                icon={faChevronUp}
                                className="h-5 w-5 text-muted-foreground"
                            />
                        ) : (
                            <FontAwesomeIcon
                                icon={faChevronDown}
                                className="h-5 w-5 text-muted-foreground"
                            />
                        )}
                    </button>
                ) : null}
            </div>

            {isExpanded && (
                <div className="animate-slide-up border-border border-t px-5 pt-4 pb-5">
                    {/* Affected services */}
                    {incident.monitors && incident.monitors.length > 0 && (
                        <div className="mb-4">
                            <h4 className="mb-2 font-medium text-muted-foreground text-xs tracking-wider">
                                Affected Services
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {incident.monitors.map((m) => (
                                    <span
                                        key={m.monitor.id}
                                        className="inline-flex items-center rounded-md bg-secondary px-2.5 py-1 font-medium text-secondary-foreground text-xs"
                                    >
                                        {m.monitor.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Updates timeline */}
                    {incident.activities && incident.activities.length > 0 && (
                        <div>
                            <h4 className="mb-3 font-medium text-muted-foreground text-xs tracking-wider">
                                Updates
                            </h4>
                            <div className="">
                                {incident.activities.map((activity, index) => (
                                    <div
                                        key={activity.id}
                                        className="relative pb-6 pl-6 last:pb-0"
                                    >
                                        {/* Timeline line */}
                                        {incident.activities.length > 1 && (
                                            <div
                                                className="absolute left-[7px] w-px bg-border"
                                                style={{
                                                    top:
                                                        index === 0
                                                            ? "13px"
                                                            : "0",
                                                    bottom:
                                                        index ===
                                                        incident.activities
                                                            .length -
                                                            1
                                                            ? "auto"
                                                            : "0",
                                                    height:
                                                        index ===
                                                        incident.activities
                                                            .length -
                                                            1
                                                            ? "13px"
                                                            : "auto",
                                                }}
                                            />
                                        )}
                                        {/* Timeline dot */}
                                        <div
                                            className={cn(
                                                "absolute top-1.5 left-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-card-foreground",
                                                // Since activity doesn't store status, we use a neutral dot or maybe based on incident status?
                                                // Let's use neutral for generic comments/activities
                                                "bg-muted-foreground/30",
                                            )}
                                        />
                                        <div>
                                            <div className="mb-1 flex items-center gap-2">
                                                {/*
                                                    If activity had a 'status' field we'd label it.
                                                    For now just showing timestamp.
                                                */}
                                                <span className="text-muted-foreground text-xs">
                                                    {new Date(
                                                        activity.createdAt,
                                                    ).toLocaleString("en-US", {
                                                        month: "short",
                                                        day: "numeric",
                                                        hour: "numeric",
                                                        minute: "2-digit",
                                                        timeZone: "UTC", // Or user local? Next.js server side uses UTC by default commonly
                                                    })}
                                                </span>
                                            </div>
                                            <p className="text-card-foreground text-sm">
                                                {activity.message}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
