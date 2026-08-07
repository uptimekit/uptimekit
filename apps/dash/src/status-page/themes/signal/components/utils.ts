import {
    formatEventDate,
    formatEventDateTime,
    getEventStatus,
    getIncidentStatus,
} from "@/status-page/lib/status-event";
import { calculateAggregateStatus } from "../../../lib/status-utils";
import type { Monitor, UptimeDay } from "../../types";

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

export const getSeverityStatus = getEventStatus;
export const getIssueStatus = getIncidentStatus;
export const formatShortDate = formatEventDate;
export const formatDateTime = formatEventDateTime;
