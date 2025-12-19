const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

try {
	// Sprawdzamy, które pliki package.json zmieniły się w ostatnim commicie
	// HEAD~1...HEAD to zakres ostatniego commita (merge'a)
	const changedFiles = execSync("git diff --name-only HEAD~1 HEAD")
		.toString()
		.trim()
		.split("\n");

	const appsDir = path.join(process.cwd(), "apps");

	if (!fs.existsSync(appsDir)) {
		console.log("[]");
		process.exit(0);
	}

	const appFolders = fs.readdirSync(appsDir);
	const releasedApps = [];

	for (const app of appFolders) {
		const appPath = path.join(appsDir, app);
		const pkgPath = path.join(appPath, "package.json");

		// Sprawdzamy czy to katalog i czy ma package.json
		if (!fs.statSync(appPath).isDirectory() || !fs.existsSync(pkgPath)) {
			continue;
		}

		// Sprawdzamy, czy package.json tego commita był zmieniany
		// Ścieżka relatywna do roota repo, np. apps/dash/package.json
		const relativePath = path
			.relative(process.cwd(), pkgPath)
			.replace(/\\/g, "/");

		if (changedFiles.includes(relativePath)) {
			const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

			// Dodajemy do listy, jeśli to nie jest prywatny pakiet pomocniczy (chyba że chcemy budować wszystko)
			// W Twoim przypadku chcesz budować to co się zmieniło, więc bierzemy wszystko co jest w apps/
			releasedApps.push({
				name: pkg.name,
				version: pkg.version,
			});
		}
	}

	console.log(JSON.stringify(releasedApps));
} catch (e) {
	console.error("Error detecting changes:", e);
	console.log("[]"); // Zwracamy pustą tablicę w razie błędu, żeby nie wywalić pipeline'u
}
