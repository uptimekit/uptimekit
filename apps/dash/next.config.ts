import { loadEnv } from "@uptimekit/config/env";
import type { NextConfig } from "next";

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
	],
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "r2.uptimekit.dev",
			},
		],
	},
};

export default nextConfig;
