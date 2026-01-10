import Redis from "ioredis";

const getRedisUrl = () => {
	if (process.env.REDIS_URL) {
		return process.env.REDIS_URL;
	}
	throw new Error("REDIS_URL is not defined");
};

// Lazy singleton - Redis is only initialized on first use, not at import time
// This prevents build failures when REDIS_URL is not available during Docker build
let redisInstance: Redis | null = null;

export const getRedis = (): Redis => {
	if (!redisInstance) {
		redisInstance = new Redis(getRedisUrl());
	}
	return redisInstance;
};

// Backwards compatibility using Proxy - lazily forwards all calls to the real Redis instance
// This avoids issues with complex method signatures like set() which has many overloads
export const redis: Redis = new Proxy({} as Redis, {
	get(_target, prop) {
		const instance = getRedis();
		const value = instance[prop as keyof Redis];
		if (typeof value === "function") {
			return value.bind(instance);
		}
		return value;
	},
});
