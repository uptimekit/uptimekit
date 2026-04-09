import { loadEnv } from "@uptimekit/config/env";
import type { NextConfig } from "next";

loadEnv();

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	output: "standalone",
	logging: {
		incomingRequests: {
			ignore: [/api\/v1\/health/],
		},
	},
};

export default nextConfig;
