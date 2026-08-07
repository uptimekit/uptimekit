import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { cn } from "@/status-page/lib/utils";
import { statusConfig } from "../../status-config";
import type { StatusType } from "../../types";

const titles: Record<StatusType, string> = {
    operational: "Fully Operational",
    degraded: "Degraded performance",
    partial_outage: "Partial outage",
    major_outage: "Major outage",
    maintenance: "Maintenance in progress",
    maintenance_scheduled: "Scheduled maintenance",
    maintenance_completed: "Maintenance completed",
    unknown: "Status unknown",
};

const descriptions: Record<StatusType, string> = {
    operational:
        "This status page reports incidents with significant, widespread user impact. Smaller or isolated issues may not appear here.",
    degraded: "Some services are responding slower than normal.",
    partial_outage: "A subset of services is currently impacted.",
    major_outage: "Multiple services are currently unavailable or unstable.",
    maintenance:
        "Planned maintenance is actively affecting one or more services.",
    maintenance_scheduled:
        "Upcoming work has been scheduled on one or more services.",
    maintenance_completed:
        "Recent maintenance work has been completed successfully.",
    unknown: "We’re unable to determine the current service state right now.",
};

interface OverallStatusProps {
    status: StatusType;
    className?: string;
}

export function OverallStatus({ status, className }: OverallStatusProps) {
    return (
        <section
            data-severity={status}
            className={cn(
                "signal-status overflow-hidden rounded-xl",
                className,
            )}
        >
            <div className="signal-status-header relative z-[1] flex w-full select-none items-start gap-2 overflow-hidden rounded-xl p-3 min-[384px]:p-4">
                <div className="shrink-0 p-1">
                    <FontAwesomeIcon icon={faChevronDown} className="h-3 w-3" />
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h1 className="min-w-0 flex-1 font-[550] text-sm leading-none min-[384px]:text-base">
                        {titles[status]}
                    </h1>
                    <div
                        className="min-h-[18px] shrink-0 pr-1 font-medium text-xs leading-[1.2] min-[384px]:text-sm"
                        style={{
                            color: "var(--signal-status-header-secondary)",
                        }}
                    >
                        {statusConfig[status].label}
                    </div>
                </div>
            </div>
            <div className="signal-status-body flex gap-3 px-4 py-3 min-[384px]:py-5 min-[384px]:pl-[25px]">
                <div
                    className="w-0.5 shrink-0 rounded-full"
                    style={{ background: "var(--signal-status-line)" }}
                />
                <div className="py-1">
                    <p className="max-w-2xl text-sm leading-6">
                        {descriptions[status]}
                    </p>
                </div>
            </div>
        </section>
    );
}
