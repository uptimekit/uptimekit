import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	serverExternalPackages: ["pg"],
	output: "standalone",
	transpilePackages: [
		"@uptimekit/api",
		"@uptimekit/db",
		"@uptimekit/auth",
		"@uptimekit/config",
	],
};

export default nextConfig;
