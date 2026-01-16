import { loadEnv } from "@uptimekit/config/env";

loadEnv();

export default {
	schema: "./src/schema",
	out: "./src/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL || "",
	},
};
