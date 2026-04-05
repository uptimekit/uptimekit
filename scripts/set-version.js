import fs from "node:fs";
import path from "node:path";

const version = process.argv[2];

if (!version) {
	console.error("Please provide a version argument");
	process.exit(1);
}

// Validation: ensure version looks like semver (simple check)
if (!/^\d+\.\d+\.\d+/.test(version)) {
	console.warn(
		`Warning: Version "${version}" might not be a valid semver string.`,
	);
}

const WORKSPACES = ["apps", "packages"];

function updateVersions() {
	console.log(`Setting all packages to version: ${version}`);

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
							console.log(`Updating ${pkg.name}: ${pkg.version} -> ${version}`);
							pkg.version = version;

							// Update dependencies if they are in the workspace (@uptimekit scope)
							const depTypes = [
								"dependencies",
								"devDependencies",
								"peerDependencies",
							];
							depTypes.forEach((type) => {
								if (pkg[type]) {
									Object.keys(pkg[type]).forEach((dep) => {
										if (dep.startsWith("@uptimekit/")) {
											// Maintain workspace: protocol if present, otherwise just set version
											const currentVal = pkg[type][dep];
											if (currentVal.startsWith("workspace:")) {
												pkg[type][dep] = `workspace:${version}`;
											} else {
												pkg[type][dep] = version;
											}
										}
									});
								}
							});

							// Write back with tabs to match biome/prettier
							fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`);
						}
					} catch (e) {
						console.error(`Failed to update version for ${entry.name}:`, e);
					}
				}
			}
		}
	});
}

updateVersions();
