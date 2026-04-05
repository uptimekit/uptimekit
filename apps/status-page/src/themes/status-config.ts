import {
	AlertCircle,
	AlertTriangle,
	CheckCircle2,
	HelpCircle,
	Wrench,
	XCircle,
} from "lucide-react";
import type { StatusType } from "./types";

export const statusConfig: Record<
	StatusType,
	{
		label: string;
		color: string;
		bgColor: string;
		icon: React.ComponentType<{ className?: string }>;
	}
> = {
	operational: {
		label: "Operational",
		color: "text-status-operational",
		bgColor: "bg-status-operational",
		icon: CheckCircle2,
	},
	degraded: {
		label: "Degraded Performance",
		color: "text-status-degraded",
		bgColor: "bg-status-degraded",
		icon: AlertTriangle,
	},
	partial_outage: {
		label: "Partial Outage",
		color: "text-status-partial-outage",
		bgColor: "bg-status-partial-outage",
		icon: AlertCircle,
	},
	major_outage: {
		label: "Outage",
		color: "text-status-major-outage",
		bgColor: "bg-status-major-outage",
		icon: XCircle,
	},
	maintenance: {
		label: "Under Maintenance",
		color: "text-status-maintenance",
		bgColor: "bg-status-maintenance",
		icon: Wrench,
	},
	maintenance_scheduled: {
		label: "Scheduled Maintenance",
		color: "text-status-partial-outage",
		bgColor: "bg-status-partial-outage",
		icon: Wrench,
	},
	maintenance_completed: {
		label: "Maintenance Completed",
		color: "text-status-operational",
		bgColor: "bg-status-operational",
		icon: CheckCircle2,
	},
	unknown: {
		label: "Unknown",
		color: "text-status-unknown",
		bgColor: "bg-status-unknown",
		icon: HelpCircle,
	},
};
