import { cn } from "@/lib/utils";
import type { StatusType } from "../../types";
import { StatusBadge } from "./status-indicator";

const titles: Record<StatusType, string> = {
	operational: "Fully operational",
	degraded: "Degraded performance",
	partial_outage: "Partial outage",
	major_outage: "Major outage",
	maintenance: "Maintenance in progress",
	maintenance_scheduled: "Scheduled maintenance",
	maintenance_completed: "Maintenance completed",
	unknown: "Status unknown",
};

const descriptions: Record<StatusType, string> = {
	operational: "We’re not aware of any issues affecting the monitored systems.",
	degraded: "Some services are responding slower than normal.",
	partial_outage: "A subset of services is currently impacted.",
	major_outage: "Multiple services are currently unavailable or unstable.",
	maintenance: "Planned maintenance is actively affecting one or more services.",
	maintenance_scheduled: "Upcoming work has been scheduled on one or more services.",
	maintenance_completed: "Recent maintenance work has been completed successfully.",
	unknown: "We’re unable to determine the current service state right now.",
};

interface OverallStatusProps {
	status: StatusType;
	lastUpdated?: string;
	className?: string;
}

export function OverallStatus({
	status,
	lastUpdated,
	className,
}: OverallStatusProps) {
	return (
		<section
			className={cn(
				"signal-panel overflow-hidden rounded-2xl border border-border",
				className,
			)}
		>
			<div className="flex items-start justify-between gap-4 border-border/80 border-b px-4 py-4 sm:px-5">
				<div className="min-w-0">
					<h1 className="font-semibold text-[18px] leading-tight text-foreground sm:text-[20px]">
						{titles[status]}
					</h1>
				</div>
				<StatusBadge status={status} className="shrink-0" />
			</div>
			<div className="flex gap-3 px-4 py-4 sm:px-5 sm:py-5">
				<div className="mt-0.5 w-0.5 shrink-0 rounded-full bg-[var(--status-operational)] opacity-90" />
				<div className="space-y-2">
					<p className="max-w-2xl text-muted-foreground text-sm leading-6 sm:text-[15px]">
						{descriptions[status]}
					</p>
					{lastUpdated ? (
						<p className="text-[12px] text-muted-foreground">
							Last updated {lastUpdated}
						</p>
					) : null}
				</div>
			</div>
		</section>
	);
}
