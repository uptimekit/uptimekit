import type { Incident, Maintenance, StatusType } from "@/themes/types";

export function getEventStatus(severity: string, status?: string): StatusType {
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

export function getIncidentStatus(incident: Incident): StatusType {
    return getEventStatus(incident.severity, incident.status);
}

export function maintenanceToIncident(maintenance: Maintenance): Incident {
    return {
        id: maintenance.id,
        title: maintenance.title,
        status: maintenance.status,
        severity: "maintenance",
        startedAt: maintenance.startAt,
        endedAt: maintenance.endAt,
        monitors: maintenance.monitors,
        activities: [],
        detailsLink: maintenance.detailsLink,
    };
}

export function formatEventDate(date: Date): string {
    return new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    });
}

export function formatEventDateTime(date: Date): string {
    return new Date(date).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC",
        hour12: false,
    });
}
