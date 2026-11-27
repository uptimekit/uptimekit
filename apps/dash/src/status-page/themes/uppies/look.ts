import { formatTooltipDate } from "@/status-page/lib/uptime";
import type { Incident, StatusType, UptimeDay } from "../types";

export type UppiesIcon = "check" | "warning" | "cross" | "wrench" | "dash";

interface StatusView {
    state: "ok" | "warn" | "down" | "none";
    word: string;
    banner: string;
    icon: UppiesIcon;
    day: "ok" | "warn" | "down" | "maint" | "none";
}

// Uppies' own words, lowercase on purpose.
export const statusViews: Record<StatusType, StatusView> = {
    operational: {
        state: "ok",
        word: "operational",
        banner: "everything is up.",
        icon: "check",
        day: "ok",
    },
    degraded: {
        state: "warn",
        word: "degraded",
        banner: "we're looking into a problem.",
        icon: "warning",
        day: "warn",
    },
    partial_outage: {
        state: "down",
        word: "partial outage",
        banner: "some things are down.",
        icon: "cross",
        day: "warn",
    },
    major_outage: {
        state: "down",
        word: "down",
        banner: "some things are down.",
        icon: "cross",
        day: "down",
    },
    maintenance: {
        state: "none",
        word: "under maintenance",
        banner: "planned maintenance is under way.",
        icon: "wrench",
        day: "maint",
    },
    maintenance_scheduled: {
        state: "none",
        word: "maintenance planned",
        banner: "planned maintenance is coming up.",
        icon: "wrench",
        day: "maint",
    },
    maintenance_completed: {
        state: "ok",
        word: "operational",
        banner: "everything is up.",
        icon: "check",
        day: "ok",
    },
    unknown: {
        state: "none",
        word: "waiting for the first check",
        banner: "waiting for the first checks.",
        icon: "dash",
        day: "none",
    },
};

export function dayTip(day: UptimeDay, digits: number): string {
    const date = formatTooltipDate(day.date);
    if (day.status === "unknown") {
        return `${date}: no data`;
    }
    return `${date}: ${day.uptime.toFixed(digits)}% up`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// The most recent incident that touched this monitor during the (UTC) day.
export function findDayIncident(
    day: UptimeDay,
    monitorId: string,
    incidents: Incident[],
): Incident | undefined {
    const dayStart = Date.parse(day.date);
    const dayEnd = dayStart + DAY_MS;
    return incidents.find(
        (incident) =>
            incident.monitors.some(({ monitor }) => monitor.id === monitorId) &&
            new Date(incident.startedAt).getTime() < dayEnd &&
            (incident.endedAt === null ||
                new Date(incident.endedAt).getTime() >= dayStart),
    );
}

export interface NavLink {
    label: string;
    url: string;
}

const MAX_NAV_LINKS = 6;

// The links are written by the page's owner but shown to every visitor, so
// only http(s) addresses get through: no javascript: or data: links.
export function parseNavLinks(raw: string): NavLink[] {
    const links: NavLink[] = [];
    for (const line of raw.split("\n")) {
        const at = line.indexOf("|");
        if (at < 0) continue;
        const label = line.slice(0, at).trim();
        const url = line.slice(at + 1).trim();
        if (label && isWebAddress(url)) links.push({ label, url });
        if (links.length === MAX_NAV_LINKS) break;
    }
    return links;
}

function isWebAddress(value: string): boolean {
    try {
        const { protocol } = new URL(value);
        return protocol === "https:" || protocol === "http:";
    } catch {
        return false;
    }
}
