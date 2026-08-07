import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    generateAccessToken,
    getCookieName,
    verifyAccessToken,
} from "./access-token";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("status page access tokens", () => {
    beforeEach(() => {
        vi.stubEnv("STATUS_PAGE_ACCESS_SECRET", "status-page-secret");
        vi.stubEnv("APP_SECRET", "");
        vi.stubEnv("BETTER_AUTH_SECRET", "");
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
    });

    it("verifies a token only for its status page", () => {
        const token = generateAccessToken("page-1");

        expect(verifyAccessToken(token, "page-1")).toBe(true);
        expect(verifyAccessToken(token, "page-2")).toBe(false);
    });

    it("rejects tampered and malformed tokens", () => {
        const token = generateAccessToken("page-1");
        const decoded = JSON.parse(
            Buffer.from(token, "base64url").toString("utf8"),
        );
        const tamperedToken = Buffer.from(
            JSON.stringify({ ...decoded, statusPageId: "page-2" }),
        ).toString("base64url");

        expect(verifyAccessToken(tamperedToken, "page-2")).toBe(false);
        expect(verifyAccessToken("not-a-token", "page-1")).toBe(false);
        expect(verifyAccessToken("", "page-1")).toBe(false);
    });

    it("expires after 24 hours", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-07-10T00:00:00Z"));
        const token = generateAccessToken("page-1");

        vi.advanceTimersByTime(DAY_MS);
        expect(verifyAccessToken(token, "page-1")).toBe(true);

        vi.advanceTimersByTime(1);
        expect(verifyAccessToken(token, "page-1")).toBe(false);
    });

    it("uses the configured secret precedence", () => {
        vi.stubEnv("APP_SECRET", "app-secret");
        vi.stubEnv("BETTER_AUTH_SECRET", "auth-secret");
        const statusSecretToken = generateAccessToken("page-1");

        vi.stubEnv("APP_SECRET", "changed-app-secret");
        vi.stubEnv("BETTER_AUTH_SECRET", "changed-auth-secret");
        expect(verifyAccessToken(statusSecretToken, "page-1")).toBe(true);

        vi.stubEnv("STATUS_PAGE_ACCESS_SECRET", "");
        const appSecretToken = generateAccessToken("page-1");
        vi.stubEnv("APP_SECRET", "another-app-secret");
        expect(verifyAccessToken(appSecretToken, "page-1")).toBe(false);
    });

    it("requires a signing secret", () => {
        vi.stubEnv("STATUS_PAGE_ACCESS_SECRET", "");
        vi.stubEnv("APP_SECRET", "");
        vi.stubEnv("BETTER_AUTH_SECRET", "");

        expect(() => generateAccessToken("page-1")).toThrow(
            "Missing required environment variable",
        );
    });

    it("names cookies by status page", () => {
        expect(getCookieName("page-1")).toBe("sp_access_page-1");
    });
});
