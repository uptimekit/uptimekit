import fs from "node:fs";
import path from "node:path";
import { createEnv } from "@t3-oss/env-core";
import { config } from "dotenv";
import { z } from "zod";

const optionalUrl = z.preprocess(
    (value) =>
        typeof value === "string" && value.trim() === "" ? undefined : value,
    z.url().trim().optional(),
);

const optionalString = z.preprocess(
    (value) =>
        typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(1).optional(),
);

function applyAppEnvFallbacks(): void {
    const env = createEnv({
        server: {
            APP_SECRET: optionalString,
            APP_STATUS_PAGE_DOMAIN: optionalString,
            APP_URL: optionalUrl,
            BETTER_AUTH_SECRET: optionalString,
            BETTER_AUTH_URL: optionalUrl,
            NEXT_PUBLIC_STATUS_PAGE_DOMAIN: optionalString,
            NEXT_PUBLIC_URL: optionalUrl,
        },
        runtimeEnv: process.env,
        emptyStringAsUndefined: true,
    });

    if (env.APP_SECRET && !env.BETTER_AUTH_SECRET) {
        process.env.BETTER_AUTH_SECRET = env.APP_SECRET;
    }

    if (env.APP_URL && !env.BETTER_AUTH_URL) {
        process.env.BETTER_AUTH_URL = env.APP_URL;
    }

    if (env.APP_URL && !env.NEXT_PUBLIC_URL) {
        process.env.NEXT_PUBLIC_URL = env.APP_URL;
    }

    if (env.APP_STATUS_PAGE_DOMAIN && !env.NEXT_PUBLIC_STATUS_PAGE_DOMAIN) {
        process.env.NEXT_PUBLIC_STATUS_PAGE_DOMAIN = env.APP_STATUS_PAGE_DOMAIN;
    }
}

/**
 * Finds the monorepo root by looking for turbo.json
 */
function findMonorepoRoot(startDir: string): string | null {
    let currentDir = startDir;

    while (currentDir !== path.parse(currentDir).root) {
        if (fs.existsSync(path.join(currentDir, "turbo.json"))) {
            return currentDir;
        }
        currentDir = path.dirname(currentDir);
    }

    return null;
}

/**
 * Loads environment variables from the monorepo root .env file.
 * Should be called at the top of entry files before any other imports
 * that depend on environment variables.
 */
export function loadEnv(): void {
    const root = findMonorepoRoot(process.cwd());

    if (!root) {
        console.warn(
            "[env] Could not find monorepo root (turbo.json not found)",
        );
        applyAppEnvFallbacks();
        return;
    }

    const envPath = path.join(root, ".env");

    if (fs.existsSync(envPath)) {
        config({ path: envPath });
    }

    applyAppEnvFallbacks();
}
