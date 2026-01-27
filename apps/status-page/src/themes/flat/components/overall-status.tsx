import { Check, AlertTriangle, AlertCircle, X, Wrench } from "lucide-react";
import type { StatusType } from "./status-indicator";

interface OverallStatusProps {
    status: StatusType;
}

const statusConfig = {
    operational: {
        icon: Check,
        bgColor: "bg-status-operational",
        title: "All services are online",
    },
    degraded: {
        icon: AlertTriangle,
        bgColor: "bg-status-degraded",
        title: "Degraded Performance",
    },
    partial_outage: {
        icon: AlertCircle,
        bgColor: "bg-status-partial-outage",
        title: "Partial System Outage",
    },
    major_outage: {
        icon: X,
        bgColor: "bg-status-major-outage",
        title: "Major System Outage",
    },
    maintenance: {
        icon: Wrench,
        bgColor: "bg-status-maintenance",
        title: "Ongoing Maintenance",
    },
    maintenance_scheduled: {
        icon: Wrench,
        bgColor: "bg-status-maintenance",
        title: "Maintenance Scheduled",
    },
    maintenance_completed: {
        icon: Check,
        bgColor: "bg-status-operational",
        title: "Maintenance Completed",
    },
    unknown: {
        icon: AlertCircle,
        bgColor: "bg-muted",
        title: "Status Unknown",
    },
};

export function OverallStatus({ status }: OverallStatusProps) {
    const config = statusConfig[status];
    const Icon = config.icon;

    const lastUpdated = new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
        hour12: false,
    });

    return (
        <div className="px-8 pb-6 pt-2 text-center">
            <div className="mx-auto mb-3 flex items-center justify-center">
                <div className="relative">
                    <div
                        className={`pointer-events-none absolute inset-0 animate-[subtle-ping_2s_ease-in-out_infinite] rounded-full ${config.bgColor}`}
                    />
                    <div
                        className={`relative flex h-12 w-12 items-center justify-center rounded-full ${config.bgColor}`}
                    >
                        <Icon className="h-6 w-6 text-background" strokeWidth={2.5} />
                    </div>
                </div>
            </div>
            <h1 className="mb-1 font-bold text-foreground text-3xl">
                {config.title}
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
                Last updated: {lastUpdated} UTC
            </p>
        </div>
    );
}
