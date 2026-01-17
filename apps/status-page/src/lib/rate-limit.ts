import { redis } from "./redis";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

export async function checkRateLimit(
	identifier: string,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
	const key = `rate-limit:password:${identifier}`;
	const now = Date.now();

	const count = await redis.incr(key);
	if (count === 1) {
		await redis.pexpire(key, WINDOW_MS);
	}

	const ttl = await redis.pttl(key);
	const resetAt = now + (ttl > 0 ? ttl : WINDOW_MS);

	return {
		allowed: count <= MAX_ATTEMPTS,
		remaining: Math.max(0, MAX_ATTEMPTS - count),
		resetAt,
	};
}
