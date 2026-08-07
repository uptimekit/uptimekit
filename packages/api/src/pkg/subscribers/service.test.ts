import { describe, expect, it } from "vitest";
import { isSubscriberEvent } from "./service";

describe("subscriber notification events", () => {
    it.each([
        "incident.created",
        "incident.updated",
        "incident.acknowledged",
        "incident.resolved",
    ] as const)("notifies subscribers for %s", (eventName) => {
        expect(isSubscriberEvent(eventName)).toBe(true);
    });

    it("does not expose internal incident comments to subscribers", () => {
        expect(isSubscriberEvent("incident.comment_added")).toBe(false);
    });
});
