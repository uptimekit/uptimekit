import { format } from "date-fns";
import type React from "react";
import { cn } from "@/status-page/lib/utils";
import type { StatusType } from "../../types";
import { StatusDot } from "./status-indicator";

interface OverallStatusProps {
    status: StatusType;
    monitorCount?: number;
    operationalCount?: number;
    incidentCount?: number;
    lastUpdated?: string;
    className?: string;
}

const statusDescriptions: Record<StatusType, string> = {
    operational: "All monitored systems and services are operating normally.",
    degraded: "Some services are experiencing degraded performance.",
    partial_outage: "A partial service disruption is currently active.",
    major_outage: "A major outage is impacting multiple core systems.",
    maintenance: "Scheduled system maintenance is currently underway.",
    maintenance_scheduled: "Upcoming scheduled maintenance is planned.",
    maintenance_completed: "All recent maintenance tasks have concluded.",
    unknown: "System telemetry is currently synchronizing.",
};

const statusTitles: Record<StatusType, string> = {
    operational: "All Systems Operational",
    degraded: "Degraded Performance",
    partial_outage: "Partial System Outage",
    major_outage: "Major System Outage",
    maintenance: "Maintenance in Progress",
    maintenance_scheduled: "Maintenance Scheduled",
    maintenance_completed: "Maintenance Completed",
    unknown: "Status Synchronizing",
};

export function OverallStatus({
    status,
    monitorCount,
    operationalCount,
    lastUpdated,
    className,
}: OverallStatusProps): React.JSX.Element {
    const title = statusTitles[status] || "System Status";
    const baseDescription =
        statusDescriptions[status] ||
        "Real-time system telemetry and uptime status.";
    const cleanBase = baseDescription.endsWith(".")
        ? baseDescription.slice(0, -1)
        : baseDescription;
    const description =
        typeof monitorCount === "number"
            ? `${cleanBase} (${operationalCount ?? monitorCount}/${monitorCount} online).`
            : baseDescription;

    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-xs transition-all",
                className,
            )}
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2.5">
                        <StatusDot status={status} />
                        <h2 className="font-semibold text-foreground text-lg tracking-tight">
                            {title}
                        </h2>
                    </div>
                    <p className="mt-1 text-muted-foreground text-sm">
                        {description}
                    </p>
                </div>

                {lastUpdated && (
                    <div className="shrink-0 text-muted-foreground text-xs sm:text-right">
                        <span className="block font-medium text-foreground/80">
                            Last updated
                        </span>
                        <span>
                            {format(lastUpdated, "dd.MM.yyyy - hh:mm:ss a")}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
