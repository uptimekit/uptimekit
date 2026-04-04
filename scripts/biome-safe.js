import { spawn } from "node:child_process";
import process from "node:process";

const files = process.argv.slice(2);

if (files.length === 0) {
	process.exit(0);
}

const args = [
	"biome",
	"check",
	"--write",
	"--no-errors-on-unmatched",
	"--files-ignore-unknown=true",
	...files,
];

const child = spawn("bunx", args, {
	stdio: "inherit",
	shell: true,
});

child.on("error", (err) => {
	console.error("Failed to start biome check:", err);
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
