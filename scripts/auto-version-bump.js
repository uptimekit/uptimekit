import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BUMP_TYPE = process.env.BUMP_TYPE || "patch";
const BASE_REF = process.env.BASE_REF || "release";

console.log(`\n🔄 Auto Version Bump Script`);
console.log(`   Bump Type: ${BUMP_TYPE}`);
console.log(`   Base Ref: ${BASE_REF}\n`);

/**
 * Parse semver version string
 */
function parseVersion(version) {
    const cleanVersion = version.split("-")[0]; // Remove any prerelease suffix
    const parts = cleanVersion.split(".");
    return {
        major: Number.parseInt(parts[0]) || 0,
        minor: Number.parseInt(parts[1]) || 0,
        patch: Number.parseInt(parts[2]) || 0,
    };
}

/**
 * Bump version based on type
 */
function bumpVersion(version, type) {
    const v = parseVersion(version);

    switch (type) {
        case "major":
            return `${v.major + 1}.0.0`;
        case "minor":
            return `${v.major}.${v.minor + 1}.0`;
        case "patch":
        default:
            return `${v.major}.${v.minor}.${v.patch + 1}`;
    }
}

/**
 * Get all changed files compared to base branch
 */
function getChangedFiles() {
    try {
        // Fetch the base branch to ensure we can compare
        execSync(`git fetch origin ${BASE_REF}`, { stdio: "pipe" });

        // Get changed files between base and current branch
        const diff = execSync(`git diff --name-only origin/${BASE_REF}...HEAD`)
            .toString()
            .trim();

        if (!diff) {
            console.log("No changed files detected");
            return [];
        }

        return diff.split("\n").filter(Boolean);
    } catch (error) {
        console.error("Error getting changed files:", error.message);
        return [];
    }
}

/**
 * Find which packages were affected by the changed files
 */
function getAffectedPackages(changedFiles) {
    const packages = new Map(); // Map<packagePath, packageJson>

    for (const file of changedFiles) {
        // Walk up the directory tree to find package.json
        let dir = path.dirname(file);

        while (dir !== "." && dir !== "/" && dir.length > 0) {
            const pkgPath = path.join(dir, "package.json");

            if (fs.existsSync(pkgPath)) {
                // Only include packages from apps/ or packages/ directories
                if (dir.startsWith("apps/") || dir.startsWith("packages/")) {
                    if (!packages.has(dir)) {
                        try {
                            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
                            packages.set(dir, {
                                path: dir,
                                pkgPath: pkgPath,
                                name: pkg.name,
                                version: pkg.version,
                            });
                        } catch (e) {
                            console.warn(`Failed to parse ${pkgPath}:`, e.message);
                        }
                    }
                }
                break;
            }
            dir = path.dirname(dir);
        }
    }

    return Array.from(packages.values());
}

/**
 * Check if package version was already bumped in this PR
 */
function isAlreadyBumped(pkgPath, changedFiles) {
    const relativePkgJson = path.join(pkgPath, "package.json").replace(/\\/g, "/");
    return changedFiles.includes(relativePkgJson);
}

/**
 * Update package.json with new version
 */
function updatePackageVersion(pkgPath, newVersion) {
    const content = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(content);
    pkg.version = newVersion;

    // Preserve formatting with tabs (matching biome style)
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, "\t") + "\n");
}

/**
 * Main execution
 */
async function main() {
    const changedFiles = getChangedFiles();

    if (changedFiles.length === 0) {
        console.log("No files changed, nothing to bump");
        return;
    }

    console.log(`📁 Found ${changedFiles.length} changed file(s)\n`);

    const affectedPackages = getAffectedPackages(changedFiles);

    if (affectedPackages.length === 0) {
        console.log("No packages affected by changes");
        return;
    }

    console.log(`📦 Affected packages:`);
    for (const pkg of affectedPackages) {
        console.log(`   - ${pkg.name} (${pkg.path})`);
    }
    console.log("");

    let bumpedCount = 0;

    for (const pkg of affectedPackages) {
        // Skip if package.json was already modified (version already bumped manually or in previous run)
        // We check this by seeing if the package.json shows as changed from base
        const newVersion = bumpVersion(pkg.version, BUMP_TYPE);

        // Get the version from the base branch to compare
        try {
            const baseContent = execSync(
                `git show origin/${BASE_REF}:${pkg.pkgPath}`,
                { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
            );
            const basePkg = JSON.parse(baseContent);

            if (basePkg.version === pkg.version) {
                // Version hasn't been bumped yet in this PR
                console.log(`✅ Bumping ${pkg.name}: ${pkg.version} → ${newVersion}`);
                updatePackageVersion(pkg.pkgPath, newVersion);
                bumpedCount++;
            } else {
                // Version was already bumped (manually or in a previous run)
                console.log(`⏭️  Skipping ${pkg.name}: version already changed (${basePkg.version} → ${pkg.version})`);
            }
        } catch (e) {
            // Package might be new, bump it
            console.log(`✅ Bumping ${pkg.name} (new package): ${pkg.version} → ${newVersion}`);
            updatePackageVersion(pkg.pkgPath, newVersion);
            bumpedCount++;
        }
    }

    console.log(`\n🎉 Done! Bumped ${bumpedCount} package(s)`);
}

main().catch((e) => {
    console.error("Error during version bump:", e);
    process.exit(1);
});
