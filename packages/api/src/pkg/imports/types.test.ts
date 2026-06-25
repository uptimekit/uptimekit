import { describe, expect, it } from "vitest";
import { importedMonitorSchema } from "./types";

const validHttp = {
    sourceId: "1",
    name: "Site",
    type: "http",
    interval: 60,
    timeout: 48,
    retries: 2,
    retryInterval: 20,
    config: {
        url: "https://example.com",
        method: "GET",
        headers: [{ key: "X-Token", value: "abc" }],
        body: "",
        acceptedStatusCodes: "200-299",
        checkSsl: true,
        sslCertExpiryNotificationDays: 30,
    },
    tagNames: [],
};

describe("importedMonitorSchema config validation", () => {
    it("accepts a well-formed http monitor", () => {
        expect(importedMonitorSchema.safeParse(validHttp).success).toBe(true);
    });

    it("rejects http config whose headers aren't a {key,value} array", () => {
        const drifted = {
            ...validHttp,
            config: { ...validHttp.config, headers: { "X-Token": "abc" } },
        };
        expect(importedMonitorSchema.safeParse(drifted).success).toBe(false);
    });

    it("rejects http config whose acceptedStatusCodes is an array, not a string", () => {
        const drifted = {
            ...validHttp,
            config: { ...validHttp.config, acceptedStatusCodes: ["200-299"] },
        };
        expect(importedMonitorSchema.safeParse(drifted).success).toBe(false);
    });

    it("rejects tcp config missing port", () => {
        const tcp = { ...validHttp, type: "tcp", config: { hostname: "h" } };
        expect(importedMonitorSchema.safeParse(tcp).success).toBe(false);
    });

    it("accepts best-effort values (empty jsonPath) for http-json", () => {
        const jsonQuery = {
            ...validHttp,
            type: "http-json",
            config: { ...validHttp.config, jsonPath: "" },
        };
        expect(importedMonitorSchema.safeParse(jsonQuery).success).toBe(true);
    });
});
