import { loadEnv } from "@uptimekit/config/env";
import type { NextConfig } from "next";

loadEnv();

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	output: "standalone",
};

export default nextConfig;
