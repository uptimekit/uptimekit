import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

try {
	// Check if there are existing unreleased changesets (excluding readme/config)
	const changesetDir = ".changeset";
	if (fs.existsSync(changesetDir)) {
		const changesets = fs
			.readdirSync(changesetDir)
			.filter((f) => f.endsWith(".md") && f !== "README.md");
		if (changesets.length > 0) {
			console.log("Existing changesets found, skipping auto-generation.");
			process.exit(0);
		}
	}

	console.log("No changesets found. looking for changed packages...");

	// Get the range of changes from environment variables
	const before = process.env.BASE_SHA;
	const after = process.env.HEAD_SHA;

	let diffCommand = "git diff --name-only HEAD~1 HEAD"; // default fallback

	if (before && before !== "0000000000000000000000000000000000000000") {
		diffCommand = `git diff --name-only ${before} ${after}`;
	} else {
		console.log("No before SHA found, checking HEAD changes");
	}

	console.log("Running:", diffCommand);
	const diff = execSync(diffCommand).toString();
	const files = diff.split("\n").filter(Boolean);
	const packages = new Set();

	files.forEach((f) => {
		let dir = path.dirname(f);
		while (dir !== "." && dir !== "/" && dir.length > 0) {
			const pkgPath = path.join(dir, "package.json");
			if (fs.existsSync(pkgPath)) {
				try {
					const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
					if (!pkg.private || pkg.private === true) {
						if (pkg.name) packages.add(pkg.name);
					}
				} catch (e) {}
				break;
			}
			dir = path.dirname(dir);
		}
	});

	if (packages.size > 0) {
		const content =
			"---\n" +
			Array.from(packages)
				.map((p) => `"${p}": patch`)
				.join("\n") +
			"\n---\n\nAuto-detected changes for canary\n";
		fs.writeFileSync(".changeset/auto-canary.md", content);
		console.log("Generated changeset for:", Array.from(packages));
	} else {
		console.log("No package changes detected");
	}
} catch (e) {
	console.error("Error generating changeset:", e);
	// Don't fail the build, let it proceed
}
