"use client";

import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import type { Incident, StatusType } from "../../types";
import { StatusDot } from "./status-indicator";

const subscribe = () => () => {};

interface IncidentCardProps {
    incident: Incident;
    isExpanded?: boolean;
    onToggle?: () => void;
    detailsLink?: string;
    className?: string;
}

function getSeverityStatus(severity: string, status?: string): StatusType {
    switch (severity) {
        case "critical":
            return "major_outage";
        case "major":
            return "partial_outage";
        case "minor":
        case "degraded":
            return "degraded";
        case "maintenance":
            if (status === "scheduled") return "maintenance_scheduled";
            if (status === "completed") return "maintenance_completed";
            return "maintenance";
        default:
            return "major_outage";
    }
}

export function IncidentCard({
    incident,
    isExpanded = false,
    onToggle,
    detailsLink,
    className,
}: IncidentCardProps) {
    const isHydrated = useSyncExternalStore(
        subscribe,
        () => true,
        () => false,
    );
    const timeZone = isHydrated ? undefined : "UTC";

    return (
        <div
            className={cn(
                "overflow-hidden rounded-xl border border-border bg-white transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700!",
                className,
            )}
        >
            <div className="flex w-full items-center justify-between p-5 text-left">
                <div className="flex items-center gap-3">
                    <StatusDot
                        status={getSeverityStatus(
                            incident.severity,
                            incident.status,
                        )}
                    />
                    <div>
                        <h3 className="font-semibold text-card-foreground">
                            {incident.title}
                        </h3>
                        <p className="mt-0.5 text-muted-foreground text-xs">
                            {new Date(incident.startedAt).toLocaleDateString(
                                "en-US",
                                {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    timeZone,
                                    hour12: false,
                                },
                            )}
                            {incident.endedAt && " — Resolved"}
                        </p>
                    </div>
                </div>

                {detailsLink ? (
                    <Link
                        href={detailsLink as any}
                        aria-label={`View details for ${incident.title}`}
                        className="rounded-full p-2 transition-colors hover:bg-muted"
                    >
                        <FontAwesomeIcon
                            icon={faChevronDown}
                            className="h-5 w-5 -rotate-90 text-muted-foreground"
                        />
                    </Link>
                ) : (
                    <button
                        type="button"
                        aria-label={
                            isExpanded ? "Collapse incident" : "Expand incident"
                        }
                        onClick={onToggle}
                        className="rounded-full p-2 transition-colors hover:bg-muted"
                    >
                        {isExpanded ? (
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
                )}
            </div>

            {isExpanded && !detailsLink && (
                <div className="animate-slide-up border-border border-t px-5 pt-4 pb-5">
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
                                                <span className="text-muted-foreground text-xs">
                                                    {new Date(
                                                        activity.createdAt,
                                                    ).toLocaleString("en-US", {
                                                        month: "short",
                                                        day: "numeric",
                                                        hour: "numeric",
                                                        minute: "2-digit",
                                                        timeZone,
                                                        hour12: false,
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
