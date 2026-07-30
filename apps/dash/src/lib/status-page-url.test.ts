import { describe, expect, it } from "vitest";
import {
    DEFAULT_STATUS_PAGE_DOMAIN,
    getStatusPageBaseDomain,
    getStatusPageUrl,
} from "./status-page-url";

describe("status page URLs", () => {
    it("uses the default domain when no domain is configured", () => {
        expect(getStatusPageBaseDomain()).toBe(DEFAULT_STATUS_PAGE_DOMAIN);
        expect(getStatusPageUrl({ slug: "demo" })).toBe(
            `https://${DEFAULT_STATUS_PAGE_DOMAIN}/demo`,
        );
    });

    it("normalizes the configured status page domain", () => {
        expect(getStatusPageBaseDomain(" https://status.example.com/// ")).toBe(
            "status.example.com",
        );
        expect(
            getStatusPageUrl(
                { slug: "demo" },
                " https://status.example.com/// ",
            ),
        ).toBe("https://status.example.com/demo");
    });

    it("preserves an explicitly configured protocol", () => {
        expect(
            getStatusPageUrl({ slug: "demo" }, "http://localhost:3001/status"),
        ).toBe("http://localhost:3001/status/demo");
    });

    it("prefers a status page custom domain", () => {
        expect(
            getStatusPageUrl(
                {
                    slug: "demo",
                    domain: "https://status.customer.example/",
                },
                "status.example.com",
            ),
        ).toBe("https://status.customer.example");
    });
});
