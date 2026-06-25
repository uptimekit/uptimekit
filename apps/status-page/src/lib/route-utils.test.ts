import { describe, expect, it } from "vitest";
import { buildPath, getDomainFromHost } from "./route-utils";

describe("buildPath", () => {
    it("keeps custom-domain routes root-relative", () => {
        expect(buildPath("/updates")).toBe("/updates");
        expect(buildPath("/incidents/incident-1")).toBe(
            "/incidents/incident-1",
        );
    });

    it("prefixes slug routes", () => {
        expect(buildPath("/updates", "irazz")).toBe("/irazz/updates");
        expect(buildPath("/", "irazz")).toBe("/irazz/");
    });
});

describe("getDomainFromHost", () => {
    it("removes ports from hostnames", () => {
        expect(getDomainFromHost("status.irazz.lol:3001")).toBe(
            "status.irazz.lol",
        );
    });
});
