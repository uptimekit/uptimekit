import type { StatusType, UptimeDay } from "@/status-page/themes/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface UptimeSegment {
    start: number;
    length: number;
    status: StatusType;
}

export interface BarSegments {
    uptime: number;
    minor: number;
    major: number;
    critical: number;
    maintenance: number;
    unknown: number;
}

export function formatDowntime(ms: number): string {
    if (ms <= 0) return "No downtime";

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        const remainingMinutes = minutes % 60;
        return remainingMinutes > 0
            ? `${hours}h ${remainingMinutes}m down`
            : `${hours}h down`;
    }

    if (minutes > 0) {
        const remainingSeconds = seconds % 60;
        return remainingSeconds > 0
            ? `${minutes}m ${remainingSeconds}s down`
            : `${minutes}m down`;
    }

    return `${seconds}s down`;
}

export function formatTooltipDate(dateString: string): string {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
        ? new Date(`${dateString}T00:00:00Z`)
        : new Date(dateString);

    return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    });
}

export function parseDuration(duration: string | undefined): number {
    if (!duration) return 0;

    const clean = duration.replace(/down/gi, "").trim();
    if (!clean) return 0;

    const hours = clean.match(/(\d+)\s*h/i)?.[1];
    const minutes = clean.match(/(\d+)\s*m/i)?.[1];
    const seconds = clean.match(/(\d+)\s*s/i)?.[1];

    return (
        (hours ? Number.parseInt(hours, 10) * 60 * 60 * 1000 : 0) +
        (minutes ? Number.parseInt(minutes, 10) * 60 * 1000 : 0) +
        (seconds ? Number.parseInt(seconds, 10) * 1000 : 0)
    );
}

export function isMaintenanceStatus(status: StatusType): boolean {
    return status === "maintenance" || status === "maintenance_scheduled";
}

export function formatMaintenanceDuration(day: UptimeDay): string {
    const maintenanceMs = day.maintenanceMs ?? parseDuration(day.duration);
    if (maintenanceMs <= 0) return "Maintenance excluded from uptime";
    return `${formatDowntime(maintenanceMs).replace(/ down$/, "")} maintenance`;
}

export function buildUptimeSegments(days: UptimeDay[]): UptimeSegment[] {
    if (days.length === 0) return [];

    const segments: UptimeSegment[] = [];
    let start = 0;
    let currentStatus = days[0].status;

    for (let index = 1; index <= days.length; index += 1) {
        const nextStatus = days[index]?.status;
        if (index === days.length || nextStatus !== currentStatus) {
            segments.push({
                start,
                length: index - start,
                status: currentStatus,
            });
            start = index;
            if (nextStatus) currentStatus = nextStatus;
        }
    }

    return segments;
}

export function calculateBarSegments(day: UptimeDay): BarSegments {
    const segments: BarSegments = {
        uptime: 100,
        minor: 0,
        major: 0,
        critical: 0,
        maintenance: 0,
        unknown: 0,
    };

    if (day.status === "unknown") {
        segments.unknown = 100;
        segments.uptime = 0;
        return segments;
    }

    const eventMs = isMaintenanceStatus(day.status)
        ? (day.maintenanceMs ?? parseDuration(day.duration))
        : (day.downtimeMs ?? parseDuration(day.duration));
    const eventPercent = Math.min(100, (eventMs / DAY_MS) * 100);
    segments.uptime = Math.max(0, 100 - eventPercent);

    switch (day.status) {
        case "degraded":
            segments.minor = eventPercent;
            break;
        case "partial_outage":
            segments.major = eventPercent;
            break;
        case "major_outage":
            segments.critical = eventPercent;
            break;
        case "maintenance":
        case "maintenance_scheduled":
            segments.maintenance = eventPercent;
            break;
    }

    return segments;
}
