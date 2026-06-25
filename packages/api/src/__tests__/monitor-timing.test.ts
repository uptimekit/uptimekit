import { describe, expect, it } from "vitest";
import {
    monitorTimingDefaults,
    monitorTimingObjectSchema,
} from "../lib/monitor-timing";

describe("monitor timing validation", () => {
    it("exposes shared defaults for API and form consumers", () => {
        expect(monitorTimingDefaults).toEqual({
            interval: 60,
            timeout: 48,
            retries: 2,
            retryInterval: 20,
        });
    });

    it("applies the default timing controls", () => {
        expect(monitorTimingObjectSchema.parse({})).toEqual({
            interval: 60,
            timeout: 48,
            retries: 2,
            retryInterval: 20,
        });
    });

    it("accepts values at the configured bounds", () => {
        expect(
            monitorTimingObjectSchema.parse({
                interval: 10,
                timeout: 300,
                retries: 0,
                retryInterval: 1,
            }),
        ).toEqual({
            interval: 10,
            timeout: 300,
            retries: 0,
            retryInterval: 1,
        });
    });

    it("rejects values outside the configured bounds", () => {
        const result = monitorTimingObjectSchema.safeParse({
            interval: 9,
            timeout: 301,
            retries: 11,
            retryInterval: 0,
        });

        expect(result.success).toBe(false);
    });

    it("rejects an explicit retry interval greater than the heartbeat interval", () => {
        const result = monitorTimingObjectSchema.safeParse({
            interval: 10,
            retryInterval: 11,
        });

        expect(result.success).toBe(false);
    });

    it("caps the default retry interval at a low heartbeat interval", () => {
        expect(monitorTimingObjectSchema.parse({ interval: 10 })).toEqual({
            interval: 10,
            timeout: 48,
            retries: 2,
            retryInterval: 10,
        });
    });

    it("keeps the 20s default retry interval for normal heartbeat intervals", () => {
        expect(
            monitorTimingObjectSchema.parse({ interval: 60 }).retryInterval,
        ).toBe(20);
    });

    it("accepts a retry interval equal to the heartbeat interval", () => {
        expect(
            monitorTimingObjectSchema.parse({
                interval: 10,
                retryInterval: 10,
            }),
        ).toEqual({
            interval: 10,
            timeout: 48,
            retries: 2,
            retryInterval: 10,
        });
    });
});
