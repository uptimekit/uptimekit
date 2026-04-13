import { redis } from "./redis";

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
	const namespace = options?.namespace || "password";
	const windowMs = options?.windowMs || WINDOW_MS;
	const maxAttempts = options?.maxAttempts || MAX_ATTEMPTS;
	const key = `rate-limit:${namespace}:${identifier}`;
	const now = Date.now();

	const count = await redis.incr(key);
	if (count === 1) {
		await redis.pexpire(key, windowMs);
	}

	let ttl = await redis.pttl(key);
	if (ttl <= 0) {
		await redis.pexpire(key, windowMs);
		ttl = windowMs;
	}

	const resetAt = now + ttl;

	return {
		allowed: count <= maxAttempts,
		remaining: Math.max(0, maxAttempts - count),
		resetAt,
	};
}
