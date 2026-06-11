import type { Monitor, StatusType } from "@/themes/types";
import { calculateAggregateStatus } from "./status-utils";

const sectionStatusText: Record<StatusType, string> = {
	operational: "All services are online",
	degraded: "Services degraded",
	partial_outage: "Partial outage",
	major_outage: "Major outage",
	maintenance: "Maintenance in progress",
	maintenance_scheduled: "Scheduled maintenance",
	maintenance_completed: "Maintenance completed",
	unknown: "Status unknown",
};

export function getSectionStatus(monitors: Monitor[]): StatusType {
	return calculateAggregateStatus(
		monitors.map((monitor) => monitor.currentStatus),
	);
}

export function getSectionStatusText(
	status: StatusType,
	totalServices: number,
): string {
	if (totalServices === 0) {
		return "No services";
	}

	return sectionStatusText[status];
}
