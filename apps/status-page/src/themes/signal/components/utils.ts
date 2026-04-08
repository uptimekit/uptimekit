import type { Incident, StatusType } from "../../types";

export function getSeverityStatus(
	severity: string,
	status?: string,
): StatusType {
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

export function getIssueStatus(incident: Incident): StatusType {
	return getSeverityStatus(incident.severity, incident.status);
}

export function formatShortDate(date: Date): string {
	return new Date(date).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	});
}

export function formatDateTime(date: Date): string {
	return new Date(date).toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZone: "UTC",
		hour12: false,
	});
}
