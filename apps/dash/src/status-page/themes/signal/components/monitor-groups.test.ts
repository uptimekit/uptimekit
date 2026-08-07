import { expect, it } from "vitest";
import type { Monitor, StatusType } from "../../types";
import { getGroupHistory } from "./utils";

function monitor(status: StatusType, uptime: number): Monitor {
    return {
        id: status,
        name: status,
        currentStatus: status,
        avgUptime: uptime,
        displayStyle: "history",
        history: [
            {
                date: "2026-07-10",
                status,
                uptime,
            },
        ],
    };
}

it("builds the group timeline from the worst monitor state", () => {
    expect(
        getGroupHistory([
            monitor("operational", 100),
            monitor("partial_outage", 95),
        ]),
    ).toMatchObject([{ status: "partial_outage", uptime: 95 }]);
});
