import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACES = ["apps", "packages"];

function getAllPackages() {
	const packages = new Map();

	for (const workspace of WORKSPACES) {
		const workspacePath = path.join(process.cwd(), workspace);
		if (!fs.existsSync(workspacePath)) continue;

		const entries = fs.readdirSync(workspacePath, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isDirectory()) {
				const pkgPath = path.join(workspacePath, entry.name, "package.json");
				if (fs.existsSync(pkgPath)) {
					try {
						const pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
						if (pkgJson.name) {
							packages.set(pkgJson.name, {
								path: pkgPath,
								workspace: workspace,
								dependencies: {
									...pkgJson.dependencies,
									...pkgJson.devDependencies,
								},
							});
						}
					} catch (e) {}
				}
			}
		}
	}
	return packages;
}

function getChangedPackagesAndDependents() {
	const allPackages = getAllPackages();
	const changedPackages = new Set();

	try {
		const before = process.env.BEFORE_SHA;
		const after = process.env.AFTER_SHA || "HEAD";

		let diffCommand = `git diff --name-only ${after}`;
		if (before && before !== "0000000000000000000000000000000000000000") {
			diffCommand = `git diff --name-only ${before}...${after}`;
		}

		console.log(`Running: ${diffCommand}`);
		const files = execSync(diffCommand).toString().trim().split("\n");

		for (const file of files) {
			if (!file) continue;

			// Normalize file path to use forward slashes for consistent comparison
			const normalizedFile = file.replace(/\\/g, "/");

			if (
				normalizedFile.endsWith("package.json") ||
				normalizedFile.endsWith("CHANGELOG.md")
			)
				continue;

			for (const [pkgName, info] of allPackages.entries()) {
				// info.path is absolute. Get its directory then relative to process.cwd()
				const pkgDir = path.dirname(info.path);
				const relPkgDir = path
					.relative(process.cwd(), pkgDir)
					.replace(/\\/g, "/");

				// Check if the file is inside the package directory
				// It should either start with "path/" or be exactly "path"
				if (
					normalizedFile.startsWith(relPkgDir + "/") ||
					normalizedFile === relPkgDir
				) {
					changedPackages.add(pkgName);
				}
			}
		}

		let added = true;
		while (added) {
			added = false;
			for (const [pkgName, info] of allPackages.entries()) {
				if (changedPackages.has(pkgName)) continue;

				const deps = Object.keys(info.dependencies || {});
				const dependsOnChanged = deps.some((d) => changedPackages.has(d));

				if (dependsOnChanged) {
					// Skip if the only changed dependency is docs
					if (
						changedPackages.size === 1 &&
						changedPackages.has("@uptimekit/docs")
					) {
						continue;
					}

					changedPackages.add(pkgName);
					added = true;
					console.log(
						`Marking ${pkgName} as changed because a dependency changed.`,
					);
				}
			}
		}

		return Array.from(changedPackages);
	} catch (e) {
		console.error("Error calculating changes:", e.message);
		return [];
	}
}

function getBumpType(message) {
	const lowerMsg = message.toLowerCase();
	if (lowerMsg.includes("[major]")) return "major";
	if (lowerMsg.includes("[minor]")) return "minor";
	if (lowerMsg.includes("[patch]") || lowerMsg.includes("[hotfix]"))
		return "patch";

	// Fallback to searching without brackets if not found
	if (lowerMsg.includes("major")) return "major";
	if (lowerMsg.includes("minor")) return "minor";
	if (lowerMsg.includes("hotfix")) return "patch";

	return "patch";
}

function generateChangeset() {
	const commitMsgs = tryGetGitMessages();
	const bumpType = getBumpType(commitMsgs);

	console.log(`Analyzing messages:\n${commitMsgs}`);

	if (!bumpType) {
		console.log("No version bump determination possible. Skipping.");
		return;
	}

	const packages = getChangedPackagesAndDependents();
	if (packages.length === 0) {
		console.log("No packages detected in changes.");
		return;
	}

	console.log(
		`Detected changes in: ${packages.join(", ")} with bump type: ${bumpType}`,
	);

	const changesetContent = `---
${packages.map((p) => `"${p}": ${bumpType}`).join("\n")}
---

${commitMsgs.trim()}
`;

	// Create .changeset directory if it doesn't exist (it should)
	const changesetDir = path.join(process.cwd(), ".changeset");
	if (!fs.existsSync(changesetDir)) {
		fs.mkdirSync(changesetDir);
	}

	// Generate a random filename nicely
	const filename = `auto-generated-${Date.now()}.md`;
	const filePath = path.join(changesetDir, filename);

	fs.writeFileSync(filePath, changesetContent);
	console.log(`Generated changeset: ${filePath}`);
}

function tryGetGitMessages() {
	try {
		const before = process.env.BEFORE_SHA;
		const after = process.env.AFTER_SHA || "HEAD";

		if (before && before !== "0000000000000000000000000000000000000000") {
			// Get all commit messages between before and after
			return execSync(`git log ${before}...${after} --pretty=%B`).toString();
		}

		return execSync("git log -1 --pretty=%B").toString();
	} catch (e) {
		return "";
	}
}

generateChangeset();
