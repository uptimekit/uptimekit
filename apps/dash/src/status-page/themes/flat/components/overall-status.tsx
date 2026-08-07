import {
    faCheck,
    faCircleExclamation,
    faTriangleExclamation,
    faWrench,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { StatusType } from "../../types";

interface OverallStatusProps {
    status: StatusType;
    lastUpdated: string | number | Date;
}

const statusConfig = {
    operational: {
        icon: faCheck,
        bgColor: "bg-status-operational",
        title: "All services are online",
    },
    degraded: {
        icon: faTriangleExclamation,
        bgColor: "bg-status-degraded",
        title: "Degraded Performance",
    },
    partial_outage: {
        icon: faCircleExclamation,
        bgColor: "bg-status-partial-outage",
        title: "Partial System Outage",
    },
    major_outage: {
        icon: faXmark,
        bgColor: "bg-status-major-outage",
        title: "Major System Outage",
    },
    maintenance: {
        icon: faWrench,
        bgColor: "bg-status-maintenance",
        title: "Ongoing Maintenance",
    },
    maintenance_scheduled: {
        icon: faWrench,
        bgColor: "bg-status-maintenance",
        title: "Maintenance Scheduled",
    },
    maintenance_completed: {
        icon: faCheck,
        bgColor: "bg-status-operational",
        title: "Maintenance Completed",
    },
    unknown: {
        icon: faCircleExclamation,
        bgColor: "bg-status-unknown",
        title: "Status Unknown",
    },
};

export function OverallStatus({ status, lastUpdated }: OverallStatusProps) {
    const config = statusConfig[status] ?? statusConfig.unknown;
    const Icon = config?.icon;

    const date = new Date(lastUpdated);
    const isValidDate = !Number.isNaN(date.getTime());

    const formattedDate = isValidDate
        ? date.toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "UTC",
              hour12: false,
          })
        : "Unknown";

    return (
        <div className="px-8 pt-2 pb-6 text-center">
            <div className="mx-auto mb-3 flex items-center justify-center">
                <div className="relative">
                    <div
                        className={`pointer-events-none absolute inset-0 animate-[subtle-ping_2s_ease-in-out_infinite] rounded-full ${config.bgColor}`}
                    />
                    <div
                        className={`relative flex h-12 w-12 items-center justify-center rounded-full ${config.bgColor}`}
                    >
                        {Icon && (
                            <FontAwesomeIcon
                                icon={Icon}
                                className="h-6 w-6 text-background"
                            />
                        )}
                    </div>
                </div>
            </div>
            <h1 className="mb-1 font-bold text-3xl text-foreground">
                {config.title}
            </h1>
            <p className="font-medium text-muted-foreground text-sm">
                Last updated: {formattedDate} UTC
            </p>
        </div>
    );
}
