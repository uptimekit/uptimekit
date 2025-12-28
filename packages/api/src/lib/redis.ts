import Redis from "ioredis";

const getRedisUrl = () => {
    if (process.env.REDIS_URL) {
        return process.env.REDIS_URL;
    }

    // Fallback or throw? For API package used in Next.js, envs should be available.
    // However, if run in context without Redis, maybe we should be careful?
    // Given the task, we assume REDIS_URL is present.
    throw new Error("REDIS_URL is not defined");
};

export const redis = new Redis(getRedisUrl());
