import { afterEach, describe, expect, it } from "vitest";
import {
    getMonitorEventMetadata,
    invalidateMonitorEventMetadataCache,
    type MonitorEventMetadata,
    setMonitorEventMetadata,
} from "./monitor-event-cache";

function metadata(name: string): MonitorEventMetadata {
    return {
        monitorConfig: {
            id: "monitor-id",
            name,
            organizationId: "organization-id",
            incidentPendingDuration: 0,
            publishIncidentToStatusPage: false,
        },
    };
}

describe("monitor event metadata cache", () => {
    afterEach(() => {
        invalidateMonitorEventMetadataCache();
    });

    it("invalidates a monitor after its assignment changes", () => {
        setMonitorEventMetadata("monitor-1", metadata("before"));

        invalidateMonitorEventMetadataCache("monitor-1");

        expect(getMonitorEventMetadata("monitor-1")).toBeUndefined();
    });

    it("can clear all cached monitor assignments", () => {
        setMonitorEventMetadata("monitor-1", metadata("one"));
        setMonitorEventMetadata("monitor-2", metadata("two"));

        invalidateMonitorEventMetadataCache();

        expect(getMonitorEventMetadata("monitor-1")).toBeUndefined();
        expect(getMonitorEventMetadata("monitor-2")).toBeUndefined();
    });
});
