import { describe, expect, it } from "vitest";
import {
    getRequestOrigin,
    getRuntimeStatusPageDomain,
} from "./status-page-runtime-config.server";
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

describe("request origin", () => {
    it("uses the forwarded protocol and host", () => {
        expect(
            getRequestOrigin(
                new Headers({
                    host: "internal:3000",
                    "x-forwarded-host": "app.example.com",
                    "x-forwarded-proto": "https",
                }),
            ),
        ).toBe("https://app.example.com");
    });

    it("defaults to HTTP without a forwarded protocol", () => {
        expect(
            getRequestOrigin(new Headers({ host: "203.0.113.10:3000" })),
        ).toBe("http://203.0.113.10:3000");
    });

    it("returns undefined without a host", () => {
        expect(getRequestOrigin(new Headers())).toBeUndefined();
    });
});
