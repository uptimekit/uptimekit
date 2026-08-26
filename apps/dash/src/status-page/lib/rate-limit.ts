import { createHash } from "node:crypto";
import { db, rateLimitBucket } from "@uptimekit/db";
import { lte, sql } from "drizzle-orm";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

export async function checkRateLimit(
    identifier: string,
    options?: {
        namespace?: string;
        windowMs?: number;
        maxAttempts?: number;
    },
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const namespace = options?.namespace ?? "password";
    const windowMs = options?.windowMs ?? WINDOW_MS;
    const maxAttempts = options?.maxAttempts ?? MAX_ATTEMPTS;
    const now = Date.now();
    const currentTime = new Date(now);
    const expiresAt = new Date(now + windowMs);
    const key = createHash("sha256")
        .update(`${namespace}:${identifier}`)
        .digest("hex");

    const currentTimeSql = sql`${currentTime.toISOString()}::timestamp`;
    const expiresAtSql = sql`${expiresAt.toISOString()}::timestamp`;

    await db
        .delete(rateLimitBucket)
        .where(lte(rateLimitBucket.expiresAt, currentTime));

    const [bucket] = await db
        .insert(rateLimitBucket)
        .values({ key, attempts: 1, expiresAt })
        .onConflictDoUpdate({
            target: rateLimitBucket.key,
            set: {
                attempts: sql<number>`case
                    when ${rateLimitBucket.expiresAt} <= ${currentTimeSql} then 1
                    else ${rateLimitBucket.attempts} + 1
                end`,
                expiresAt: sql<Date>`case
                    when ${rateLimitBucket.expiresAt} <= ${currentTimeSql} then ${expiresAtSql}
                    else ${rateLimitBucket.expiresAt}
                end`,
            },
        })
        .returning({
            attempts: rateLimitBucket.attempts,
            expiresAt: rateLimitBucket.expiresAt,
        });

    if (!bucket) {
        throw new Error("Failed to update rate limit");
    }

    const resetAt = bucket.expiresAt.getTime();

    return {
        allowed: bucket.attempts <= maxAttempts,
        remaining: Math.max(0, maxAttempts - bucket.attempts),
        resetAt,
    };
}
