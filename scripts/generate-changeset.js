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
		const currentCommit = execSync("git rev-parse HEAD").toString().trim();
		const files = execSync(
			`git diff-tree --no-commit-id --name-only -r ${currentCommit}`,
		)
			.toString()
			.trim()
			.split("\n");

		for (const file of files) {
			if (!file) continue;
			for (const [pkgName, info] of allPackages.entries()) {
				const relPath = path.relative(process.cwd(), path.dirname(info.path));
				if (file.startsWith(relPath + path.sep) || file === relPath) {
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
	if (lowerMsg.includes("major")) return "major";
	if (lowerMsg.includes("minor")) return "minor";
	if (lowerMsg.includes("hotfix")) return "patch";
	return "patch";
}

function generateChangeset() {
	const commitMsg = process.env.COMMIT_MESSAGE || tryGetGitMessage();
	const bumpType = getBumpType(commitMsg);

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

${commitMsg.trim()}
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

function tryGetGitMessage() {
	try {
		return execSync("git log -1 --pretty=%B").toString();
	} catch (e) {
		return "";
	}
}

generateChangeset();
