import { describe, expect, it, vi } from "vitest";
import { runReadinessChecks } from "./health";

describe("runReadinessChecks", () => {
    it("reports healthy when every dependency responds", async () => {
        const result = await runReadinessChecks({
            database: async () => undefined,
            redis: async () => "PONG",
        });

        expect(result.ok).toBe(true);
        expect(result.checks.database?.ok).toBe(true);
        expect(result.checks.redis?.ok).toBe(true);
    });

    it("reports unhealthy without exposing dependency errors", async () => {
        const result = await runReadinessChecks({
            database: async () => {
                throw new Error("postgres://secret@database");
            },
        });

        expect(result).toMatchObject({
            ok: false,
            checks: { database: { ok: false } },
        });
        expect(JSON.stringify(result)).not.toContain("secret");
    });

    it("times out stalled dependencies", async () => {
        vi.useFakeTimers();
        const resultPromise = runReadinessChecks(
            { redis: () => new Promise(() => undefined) },
            100,
        );

        await vi.advanceTimersByTimeAsync(100);
        const result = await resultPromise;
        vi.useRealTimers();

        expect(result.ok).toBe(false);
        expect(result.checks.redis?.ok).toBe(false);
    });
});
