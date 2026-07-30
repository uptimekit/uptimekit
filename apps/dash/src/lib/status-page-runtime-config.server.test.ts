import { describe, expect, it } from "vitest";
import { getRuntimeStatusPageDomain } from "./status-page-runtime-config.server";
import { DEFAULT_STATUS_PAGE_DOMAIN } from "./status-page-url";

describe("runtime status page domain", () => {
    it("prefers APP_STATUS_PAGE_DOMAIN", () => {
        expect(
            getRuntimeStatusPageDomain({
                APP_STATUS_PAGE_DOMAIN: " status.example.com ",
                NEXT_PUBLIC_STATUS_PAGE_DOMAIN: "legacy.example.com",
            }),
        ).toBe("status.example.com");
    });

    it("supports NEXT_PUBLIC_STATUS_PAGE_DOMAIN at runtime", () => {
        expect(
            getRuntimeStatusPageDomain({
                NEXT_PUBLIC_STATUS_PAGE_DOMAIN: " legacy.example.com ",
            }),
        ).toBe("legacy.example.com");
    });

    it("ignores empty values and uses the default domain", () => {
        expect(
            getRuntimeStatusPageDomain({
                APP_STATUS_PAGE_DOMAIN: " ",
                NEXT_PUBLIC_STATUS_PAGE_DOMAIN: "",
            }),
        ).toBe(DEFAULT_STATUS_PAGE_DOMAIN);
    });
});
