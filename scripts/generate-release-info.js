import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const WORKSPACES = ["apps", "packages"];
const DOCKER_APPS = {
	"@uptimekit/dash": "uptimekit-dash",
	"@uptimekit/worker": "uptimekit-worker",
	"@uptimekit/status-page": "uptimekit-status-page",
};

function getPackageJson(filePath) {
	if (!fs.existsSync(filePath)) return null;
	return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function getPreviousVersion(filePath) {
	try {
		const relativePath = path
			.relative(process.cwd(), filePath)
			.replace(/\\/g, "/");

		const ref =
			process.env.BEFORE_SHA &&
			process.env.BEFORE_SHA !== "0000000000000000000000000000000000000000"
				? process.env.BEFORE_SHA
				: "HEAD";

		const content = execFileSync("git", ["show", `${ref}:${relativePath}`], {
			encoding: "utf-8",
		});
		return JSON.parse(content).version;
	} catch (e) {
		return null;
	}
}

function generateReleaseInfo() {
	const changes = [];
	let mainVersion = null;

	for (const workspace of WORKSPACES) {
		const workspacePath = path.join(process.cwd(), workspace);
		if (!fs.existsSync(workspacePath)) continue;

		const entries = fs.readdirSync(workspacePath, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isDirectory()) {
				const pkgPath = path.join(workspacePath, entry.name, "package.json");
				const pkg = getPackageJson(pkgPath);

				if (pkg) {
					const prevVersion = getPreviousVersion(pkgPath);
					if (prevVersion && pkg.version !== prevVersion) {
						changes.push({
							name: pkg.name,
							version: pkg.version,
							prevVersion,
							dockerImage: DOCKER_APPS[pkg.name],
						});

						// Prioritize dash version for the tag, or just use the first one
						if (pkg.name === "@uptimekit/dash" || !mainVersion) {
							mainVersion = pkg.version;
						}
					}
				}
			}
		}
	}

	if (changes.length === 0) {
		console.log("No version changes detected.");
		return;
	}

	// Generate Markdown Body
	let body = "## Release Changes\n\n";

	for (const change of changes) {
		body += `### ${change.name}\n`;
		body += `**Version**: \`${change.prevVersion}\` -> \`${change.version}\`\n`;

		if (change.dockerImage) {
			body += `**Docker Hub**: [${change.dockerImage}](https://hub.docker.com/r/strikx/${change.dockerImage})\n`;
		}
		body += "\n";
	}

	const releaseNotesPath = path.join(process.cwd(), "release_notes.md");
	fs.writeFileSync(releaseNotesPath, body);

	// Set GitHub Actions outputs
	if (process.env.GITHUB_OUTPUT) {
		fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${mainVersion}\n`);
	}

	console.log(`Release version: ${mainVersion}`);
	console.log(`Release notes written to ${releaseNotesPath}`);
}

generateReleaseInfo();
