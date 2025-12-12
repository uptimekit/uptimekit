import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	serverExternalPackages: ["pg"],
	output: "standalone",
};

export default nextConfig;
