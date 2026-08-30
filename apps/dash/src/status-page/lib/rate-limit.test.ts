import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const deleteWhere = vi.fn();
    const deleteBucket = vi.fn(() => ({ where: deleteWhere }));
    const returning = vi.fn();
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    const values = vi.fn(
        (_value: { key: string; attempts: number; expiresAt: Date }) => ({
            onConflictDoUpdate,
        }),
    );
    const insertBucket = vi.fn(() => ({ values }));

    return {
        deleteWhere,
        deleteBucket,
        returning,
        onConflictDoUpdate,
        values,
        insertBucket,
    };
});

vi.mock("@uptimekit/db", () => ({
    db: {
        delete: mocks.deleteBucket,
        insert: mocks.insertBucket,
    },
    rateLimitBucket: {
        key: "key-column",
        attempts: "attempts-column",
        expiresAt: "expires-at-column",
    },
}));

vi.mock("drizzle-orm", () => ({
    lte: vi.fn((left, right) => ({ left, right })),
    sql: vi.fn((strings, ...values) => ({ strings, values })),
}));

import { sql } from "drizzle-orm";
import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-08-09T12:00:00.000Z"));
        mocks.deleteWhere.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("stores a hashed identifier and returns the shared bucket state", async () => {
        const expiresAt = new Date("2026-08-09T12:15:00.000Z");
        mocks.returning.mockResolvedValue([{ attempts: 1, expiresAt }]);

        const result = await checkRateLimit("203.0.113.1:page-id");

        expect(mocks.values).toHaveBeenCalledWith({
            key: expect.stringMatching(/^[a-f0-9]{64}$/),
            attempts: 1,
            expiresAt,
        });
        expect(mocks.values.mock.calls[0]?.[0].key).not.toContain(
            "203.0.113.1",
        );
        expect(result).toEqual({
            allowed: true,
            remaining: 4,
            resetAt: expiresAt.getTime(),
        });
    });

    it("never passes raw Date values into sql fragments", async () => {
        // Drizzle's postgres-js driver disables the driver's timestamp
        // serializers, so a Date inside a raw `sql` template crashes the query
        // with ERR_INVALID_ARG_TYPE instead of being sent as a timestamp.
        mocks.returning.mockResolvedValue([
            { attempts: 1, expiresAt: new Date("2026-08-09T12:15:00.000Z") },
        ]);

        await checkRateLimit("203.0.113.1:page-id");

        const containsDate = (value: unknown): boolean => {
            if (value instanceof Date) return true;
            if (Array.isArray(value)) return value.some(containsDate);
            if (value && typeof value === "object") {
                return Object.values(value).some(containsDate);
            }
            return false;
        };

        const sqlCalls = vi
            .mocked(sql)
            .mock.results.map((result) => result.value);
        expect(sqlCalls.length).toBeGreaterThan(0);
        expect(sqlCalls.some(containsDate)).toBe(false);
    });

    it("rejects attempts over the configured maximum", async () => {
        const expiresAt = new Date("2026-08-09T12:01:00.000Z");
        mocks.returning.mockResolvedValue([{ attempts: 3, expiresAt }]);

        const result = await checkRateLimit("client", {
            windowMs: 60_000,
            maxAttempts: 2,
        });

        expect(result).toEqual({
            allowed: false,
            remaining: 0,
            resetAt: expiresAt.getTime(),
        });
    });
});
