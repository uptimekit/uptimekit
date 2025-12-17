import fs from "node:fs";
import path from "node:path";

const WORKSPACES = ["apps", "packages"];

function bumpVersions() {
	console.log("Starting version bump for next development cycle...");

	WORKSPACES.forEach((workspace) => {
		const workspacePath = path.join(process.cwd(), workspace);
		if (!fs.existsSync(workspacePath)) return;

		const entries = fs.readdirSync(workspacePath, { withFileTypes: true });

		for (const entry of entries) {
			if (entry.isDirectory()) {
				const pkgPath = path.join(workspacePath, entry.name, "package.json");

				if (fs.existsSync(pkgPath)) {
					try {
						const content = fs.readFileSync(pkgPath, "utf8");
						const pkg = JSON.parse(content);

						if (pkg.version) {
							// Strip any pre-release tags (like -canary) and split
							const cleanVersion = pkg.version.split("-")[0];
							const parts = cleanVersion.split(".");

							// Bump patch version
							parts[2] = Number.parseInt(parts[2]) + 1;
							const newVersion = parts.join(".");

							console.log(
								`Bumping ${pkg.name}: ${pkg.version} -> ${newVersion}`,
							);
							pkg.version = newVersion;

							// Write back with tabs to match biome/prettier
							fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, "\t") + "\n");
						}
					} catch (e) {
						console.error(`Failed to bump version for ${entry.name}:`, e);
					}
				}
			}
		}
	});
}

bumpVersions();
