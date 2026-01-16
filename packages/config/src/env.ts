import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";

/**
 * Finds the monorepo root by looking for turbo.json
 */
function findMonorepoRoot(startDir: string): string | null {
	let currentDir = startDir;

	while (currentDir !== path.parse(currentDir).root) {
		if (fs.existsSync(path.join(currentDir, "turbo.json"))) {
			return currentDir;
		}
		currentDir = path.dirname(currentDir);
	}

	return null;
}

/**
 * Loads environment variables from the monorepo root .env file.
 * Should be called at the top of entry files before any other imports
 * that depend on environment variables.
 */
export function loadEnv(): void {
	const root = findMonorepoRoot(process.cwd());

	if (!root) {
		console.warn("[env] Could not find monorepo root (turbo.json not found)");
		return;
	}

	const envPath = path.join(root, ".env");

	if (fs.existsSync(envPath)) {
		config({ path: envPath });
	}
}
