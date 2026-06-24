import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
	faCircleCheck,
	faCircleExclamation,
	faCircleQuestion,
	faCircleXmark,
	faTriangleExclamation,
	faWrench,
} from "@fortawesome/free-solid-svg-icons";
import type { StatusType } from "./types";

export const statusConfig: Record<
	StatusType,
	{
		label: string;
		color: string;
		bgColor: string;
		icon: IconDefinition;
	}
> = {
	operational: {
		label: "Operational",
		color: "text-status-operational",
		bgColor: "bg-status-operational",
		icon: faCircleCheck,
	},
	degraded: {
		label: "Degraded Performance",
		color: "text-status-degraded",
		bgColor: "bg-status-degraded",
		icon: faTriangleExclamation,
	},
	partial_outage: {
		label: "Partial Outage",
		color: "text-status-partial-outage",
		bgColor: "bg-status-partial-outage",
		icon: faCircleExclamation,
	},
	major_outage: {
		label: "Outage",
		color: "text-status-major-outage",
		bgColor: "bg-status-major-outage",
		icon: faCircleXmark,
	},
	maintenance: {
		label: "Under Maintenance",
		color: "text-status-maintenance",
		bgColor: "bg-status-maintenance",
		icon: faWrench,
	},
	maintenance_scheduled: {
		label: "Scheduled Maintenance",
		color: "text-status-partial-outage",
		bgColor: "bg-status-partial-outage",
		icon: faWrench,
	},
	maintenance_completed: {
		label: "Maintenance Completed",
		color: "text-status-operational",
		bgColor: "bg-status-operational",
		icon: faCircleCheck,
	},
	unknown: {
		label: "Unknown",
		color: "text-status-unknown",
		bgColor: "bg-status-unknown",
		icon: faCircleQuestion,
	},
};
