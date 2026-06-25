import { defineConfig } from "vitest/config";

export default defineConfig({
    css: {
        postcss: {
            plugins: [],
        },
    },
    test: {
        environment: "node",
    },
});
