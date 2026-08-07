import { describe, expect, it } from "vitest";
import type { Maintenance } from "@/themes/types";
import {
    formatEventDate,
    formatEventDateTime,
    getEventStatus,
    maintenanceToIncident,
} from "./status-event";

describe("status event semantics", () => {
    it.each([
        ["critical", undefined, "major_outage"],
        ["major", undefined, "partial_outage"],
        ["minor", undefined, "degraded"],
        ["maintenance", "scheduled", "maintenance_scheduled"],
        ["maintenance", "completed", "maintenance_completed"],
    ])("maps %s/%s to %s", (severity, status, expected) => {
        expect(getEventStatus(severity, status)).toBe(expected);
    });

    it("adapts maintenance to the shared incident presentation model", () => {
        const maintenance: Maintenance = {
            id: "maintenance-1",
            title: "Database upgrade",
            description: "Planned maintenance",
            status: "scheduled",
            startAt: new Date("2026-08-07T20:00:00Z"),
            endAt: new Date("2026-08-07T21:00:00Z"),
            createdAt: new Date("2026-08-01T10:00:00Z"),
            monitors: [
                {
                    monitorId: "monitor-1",
                    monitor: { id: "monitor-1", name: "API" },
                },
            ],
            detailsLink: "/incidents/maintenance-1",
        };

        expect(maintenanceToIncident(maintenance)).toMatchObject({
            id: "maintenance-1",
            severity: "maintenance",
            startedAt: maintenance.startAt,
            endedAt: maintenance.endAt,
            activities: [],
        });
    });

    it("formats public event dates in UTC", () => {
        const date = new Date("2026-08-07T23:30:00-07:00");

        expect(formatEventDate(date)).toBe("Aug 8, 2026");
        expect(formatEventDateTime(date)).toContain("Aug 8");
    });
});
