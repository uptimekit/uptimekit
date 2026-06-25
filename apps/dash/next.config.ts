/** biome-ignore-all assist/source/organizeImports: keep external imports grouped before workspace imports */
import withBundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

import { loadEnv } from "@uptimekit/config/env";

loadEnv();

const nextConfig: NextConfig = {
    typedRoutes: true,
    reactCompiler: true,
    output: "standalone",
    transpilePackages: [
        "@uptimekit/api",
        "@uptimekit/db",
        "@uptimekit/auth",
        "@uptimekit/config",
        "@uptimekit/scheduler",
    ],
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "r2.uptimekit.dev",
            },
        ],
    },
    logging: {
        incomingRequests: true,
    },
};

export default withBundleAnalyzer({
    enabled: process.env.ANALYZE === "true",
})(nextConfig);
