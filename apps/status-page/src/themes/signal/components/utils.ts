import { calculateAggregateStatus } from "../../../lib/status-utils";
import type { Incident, Monitor, StatusType, UptimeDay } from "../../types";

export function getGroupHistory(monitors: Monitor[]): UptimeDay[] {
    return (monitors[0]?.history ?? []).map((day, index) => {
        const days = monitors
            .map((monitor) => monitor.history[index])
            .filter((item): item is UptimeDay => item?.date === day.date);

        return {
            ...day,
            status: calculateAggregateStatus(days.map((item) => item.status)),
            uptime: Math.min(...days.map((item) => item.uptime)),
            downtimeMs: days.reduce(
                (total, item) => total + (item.downtimeMs ?? 0),
                0,
            ),
            maintenanceMs: days.reduce(
                (total, item) => total + (item.maintenanceMs ?? 0),
                0,
            ),
        };
    });
}

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
