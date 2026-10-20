import { describe, expect, it } from "vitest";
import { getMaintenanceStatus } from "./maintenance-status";

const now = new Date("2026-10-20T19:00:00Z");

describe("getMaintenanceStatus", () => {
    it("is scheduled before the window starts", () => {
        expect(
            getMaintenanceStatus(
                {
                    startedAt: new Date("2026-10-20T20:00:00Z"),
                    plannedEndAt: new Date("2026-10-20T21:00:00Z"),
                    endedAt: null,
                },
                now,
            ),
        ).toBe("scheduled");
    });

    it("is in progress inside the window", () => {
        expect(
            getMaintenanceStatus(
                {
                    startedAt: new Date("2026-10-20T18:00:00Z"),
                    plannedEndAt: new Date("2026-10-20T21:00:00Z"),
                    endedAt: null,
                },
                now,
            ),
        ).toBe("in_progress");
    });

    it("is completed once the planned end has passed", () => {
        expect(
            getMaintenanceStatus(
                {
                    startedAt: new Date("2026-10-20T16:00:00Z"),
                    plannedEndAt: new Date("2026-10-20T18:00:00Z"),
                    endedAt: null,
                },
                now,
            ),
        ).toBe("completed");
    });

    it("is completed when ended early", () => {
        expect(
            getMaintenanceStatus(
                {
                    startedAt: new Date("2026-10-20T18:00:00Z"),
                    plannedEndAt: new Date("2026-10-20T21:00:00Z"),
                    endedAt: new Date("2026-10-20T18:30:00Z"),
                },
                now,
            ),
        ).toBe("completed");
    });
});
