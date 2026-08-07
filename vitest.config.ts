import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        projects: [
            "apps/dash/vitest.config.mts",
            "packages/db/vitest.config.ts",
            {
                test: {
                    name: "workspace",
                    include: [
                        "apps/**/*.test.{ts,tsx}",
                        "packages/**/*.test.{ts,tsx}",
                    ],
                    exclude: [
                        ...configDefaults.exclude,
                        "apps/dash/**",
                        "packages/db/**",
                    ],
                },
            },
        ],
    },
});
