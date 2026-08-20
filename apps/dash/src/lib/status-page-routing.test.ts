import { describe, expect, it } from "vitest";
import {
    getHostnameFromHostHeader,
    getStatusPageRewritePath,
    isPublicAssetPath,
    isStatusPageHost,
} from "./status-page-routing";

describe("status page request routing", () => {
    const environment = {
        APP_URL: "https://app.example.com",
        APP_STATUS_PAGE_DOMAIN: "status.example.com",
    };

    it("routes the configured status host and custom domains", () => {
        expect(isStatusPageHost("status.example.com", environment)).toBe(true);
        expect(isStatusPageHost("status.customer.com", environment)).toBe(true);
    });

    it("extracts hostnames from request host headers", () => {
        expect(getHostnameFromHostHeader("status.example.com:3000")).toBe(
            "status.example.com",
        );
        expect(getHostnameFromHostHeader("[::1]:3000")).toBe("::1");
    });

    it("keeps the dashboard and local development hosts on the dashboard", () => {
        expect(isStatusPageHost("app.example.com", environment)).toBe(false);
        expect(isStatusPageHost("localhost", environment)).toBe(false);
    });

    it("rewrites public paths into the internal namespace", () => {
        expect(getStatusPageRewritePath("/")).toBe("/status");
        expect(getStatusPageRewritePath("/badge")).toBe("/status/badge");
        expect(getStatusPageRewritePath("/acme/updates")).toBe(
            "/status/acme/updates",
        );
        expect(getStatusPageRewritePath("/acme/badge")).toBe(
            "/status/acme/badge",
        );
    });

    it("does not treat feeds as static assets", () => {
        expect(isPublicAssetPath("/_next/static/chunk.js")).toBe(true);
        expect(isPublicAssetPath("/logo.svg")).toBe(true);
        expect(isPublicAssetPath("/acme/rss.xml")).toBe(false);
    });
});
