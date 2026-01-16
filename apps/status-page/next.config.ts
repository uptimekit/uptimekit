import { loadEnv } from "@uptimekit/config/env";
import type { NextConfig } from "next";

loadEnv();

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	serverExternalPackages: ["pg"],
	output: "standalone",
};

export default nextConfig;
