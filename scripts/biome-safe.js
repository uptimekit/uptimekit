import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const files = process.argv.slice(2);

if (files.length === 0) {
	process.exit(0);
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(repoRoot, "package.json"));
const biomeBin = require.resolve("@biomejs/biome/bin/biome");

const args = [
	"check",
	"--write",
	"--no-errors-on-unmatched",
	"--files-ignore-unknown=true",
	...files,
];

const child = spawn(process.execPath, [biomeBin, ...args], {
	stdio: "inherit",
});

child.on("error", (err) => {
	console.error("Failed to start Biome:", err);
	process.exit(0);
});

child.on("close", (code) => {
	if (code !== 0) {
		console.log(
			"\n⚠️  Biome found issues that could not be automatically fixed, but committing anyway (non-blocking mode).",
		);
	}
	// Always exit 0
	process.exit(0);
});
