import { describe, expect, it } from "vitest";
import { normalizeStatusPageDomain } from "./status-page-domain";

function expectDomainError(value: string, message: string) {
    try {
        normalizeStatusPageDomain(value);
        throw new Error("Expected custom domain validation to fail");
    } catch (error) {
        expect(error instanceof Error ? error.message : "").toBe(message);
    }
}

describe("normalizeStatusPageDomain", () => {
    it("normalizes hostnames", () => {
        expect(normalizeStatusPageDomain(" Status.Irazz.LOL. ")).toBe(
            "status.irazz.lol",
        );
        expect(normalizeStatusPageDomain("https://infra.example.com/")).toBe(
            "infra.example.com",
        );
        expect(normalizeStatusPageDomain("infra.example.com/")).toBe(
            "infra.example.com",
        );
        expect(normalizeStatusPageDomain("")).toBeNull();
        expect(normalizeStatusPageDomain(null)).toBeNull();
    });

    it("rejects values that cannot be matched safely from a Host header", () => {
        expectDomainError(
            "status.example.com:3001",
            "Custom domain cannot include a path, port, query, or hash",
        );
        expectDomainError(
            "https://status.example.com/path",
            "Custom domain cannot include a path, port, query, or hash",
        );
        expectDomainError(
            "*.example.com",
            "Wildcard custom domains are not supported",
        );
        expectDomainError(
            "localhost",
            "Custom domain must include a top-level domain",
        );
        expectDomainError(
            "status.local",
            "Custom domain cannot use a reserved internal hostname",
        );
        expectDomainError(
            "127.0.0.1",
            "Custom domain must be a hostname, not an IP address",
        );
    });
});
