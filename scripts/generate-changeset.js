import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACES = ['apps', 'packages'];

// Helper to get all packages in the monorepo
function getAllPackages() {
    const packages = new Map(); // name -> { path, dependencies, devDependencies }

    for (const workspace of WORKSPACES) {
        // Assume flat structure for simplicity (apps/* or packages/*)
        // For recursive struct, we'd need glob.
        const workspacePath = path.join(process.cwd(), workspace);
        if (!fs.existsSync(workspacePath)) continue;

        const entries = fs.readdirSync(workspacePath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const pkgPath = path.join(workspacePath, entry.name, 'package.json');
                if (fs.existsSync(pkgPath)) {
                    try {
                        const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                        if (pkgJson.name) {
                            packages.set(pkgJson.name, {
                                path: pkgPath,
                                workspace: workspace, // 'apps' or 'packages'
                                dependencies: { ...pkgJson.dependencies, ...pkgJson.devDependencies }
                            });
                        }
                    } catch (e) { }
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
        const currentCommit = execSync('git rev-parse HEAD').toString().trim();
        const files = execSync(`git diff-tree --no-commit-id --name-only -r ${currentCommit}`)
            .toString()
            .trim()
            .split('\n');

        // Identify directly changed packages
        for (const file of files) {
            if (!file) continue;
            for (const [pkgName, info] of allPackages.entries()) {
                const relPath = path.relative(process.cwd(), path.dirname(info.path));
                if (file.startsWith(relPath + path.sep) || file === relPath) {
                    changedPackages.add(pkgName);
                }
            }
        }

        // Propagate changes to dependents
        // We want to find any package that has a dependency on a changed package, recursively?
        // User said: "If dep changed... bump version of given app".
        // If PkgA changed, and PkgB depends on PkgA => PkgB changed.
        // If App1 depends on PkgB => App1 changed.

        // Simple propagation loop
        let added = true;
        while (added) {
            added = false;
            for (const [pkgName, info] of allPackages.entries()) {
                if (changedPackages.has(pkgName)) continue;

                // Check if any of its dependencies are in changedPackages
                const deps = Object.keys(info.dependencies || {});
                const dependsOnChanged = deps.some(d => changedPackages.has(d));

                if (dependsOnChanged) {
                    changedPackages.add(pkgName);
                    added = true;
                    console.log(`Marking ${pkgName} as changed because a dependency changed.`);
                }
            }
        }

        return Array.from(changedPackages);
    } catch (e) {
        console.error('Error calculating changes:', e.message);
        return [];
    }
}

function getBumpType(message) {
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes('major')) return 'major';
    if (lowerMsg.includes('minor')) return 'minor';
    if (lowerMsg.includes('hotfix')) return 'patch';
    // Default to patch if uncertain? Or maybe none? 
    // User said: "z dopiskiem hotfix... z dopiskiem major". 
    // If no keyword, maybe no bump? Or default patch?
    // Let's assume if no keyword is found, we don't generate a changeset (or maybe default to patch if we want to be safe, but "hotfix" implies explicit intent).
    // However, for standard dev flow, usually any fix is a patch.
    // The user prompt specifically mentions "z dopiskiem...".
    // User update: "Jesli nic nie znaleziono, deafuluj do hotfixa" -> Default to patch.
    return 'patch';
}

function generateChangeset() {
    const commitMsg = process.env.COMMIT_MESSAGE || tryGetGitMessage();
    const bumpType = getBumpType(commitMsg);

    // bumpType will now always be at least 'patch', so this check is redundant for null, but kept for safety if we change logic later.
    if (!bumpType) {
        console.log('No version bump determination possible. Skipping.');
        return;
    }

    const packages = getChangedPackagesAndDependents();
    if (packages.length === 0) {
        console.log('No packages detected in changes.');
        return;
    }

    console.log(`Detected changes in: ${packages.join(', ')} with bump type: ${bumpType}`);

    const changesetContent = `---
${packages.map(p => `"${p}": ${bumpType}`).join('\n')}
---

${commitMsg.trim()}
`;

    // Create .changeset directory if it doesn't exist (it should)
    const changesetDir = path.join(process.cwd(), '.changeset');
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
        return execSync('git log -1 --pretty=%B').toString();
    } catch (e) {
        return '';
    }
}

generateChangeset();
