import { config } from "dotenv";
import fs from "fs";
import path from "path";

const paths = ["../../.env", "../../apps/dash/.env", ".env"];

for (const p of paths) {
	const fullPath = path.resolve(process.cwd(), p);
	if (fs.existsSync(fullPath)) {
		config({ path: fullPath });
		break;
	}
}

export default {
	schema: "./src/schema",
	out: "./src/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL || "",
	},
};
