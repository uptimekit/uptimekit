const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const postgresModule = require("postgres");
const postgres = postgresModule.default || postgresModule;
const { drizzle } = require("drizzle-orm/postgres-js");
const { migrate } = require("drizzle-orm/postgres-js/migrator");
const { createClient } = require("@clickhouse/client");

const isColumnAlreadyExistsError = (error) => {
	const errorStr = error?.toString?.() || error?.message || "";
	return (
		error?.code === "42701" ||
		error?.cause?.code === "42701" ||
		(errorStr.includes("42701") && errorStr.includes("already exists"))
	);
};

const isTableAlreadyExistsError = (error) => {
	const errorStr = error?.toString?.() || error?.message || "";
	return (
		error?.code === "42P07" ||
		error?.cause?.code === "42P07" ||
		(errorStr.includes("42P07") && errorStr.includes("already exists"))
	);
};

const isConstraintAlreadyExistsError = (error) => {
	const errorStr = error?.toString?.() || error?.message || "";
	return (
		error?.code === "42710" ||
		error?.cause?.code === "42710" ||
		(errorStr.includes("42710") && errorStr.includes("already exists"))
	);
};

const getMigrationFiles = (migrationsFolder) => {
	const files = fs
		.readdirSync(migrationsFolder)
		.filter((f) => f.endsWith(".sql"))
		.sort();

	return files.map((file) => {
		const filePath = path.join(migrationsFolder, file);
		const content = fs.readFileSync(filePath, "utf8");
		const hash = crypto.createHash("sha256").update(content).digest("hex");
		return { file, hash };
	});
};

const syncMigrationJournal = async (client, migrationsFolder) => {
	console.log("🔄 Checking migration journal...");

	const migrationFiles = getMigrationFiles(migrationsFolder);
	const appliedMigrations = await client`
		SELECT hash FROM drizzle.__drizzle_migrations
	`;
	const appliedHashes = new Set(appliedMigrations.map((m) => m.hash));

	const missingMigrations = migrationFiles.filter(
		(m) => !appliedHashes.has(m.hash),
	);

	if (missingMigrations.length === 0) {
		console.log("✅ All migrations are already recorded");
		return;
	}

	console.log(
		`⚠️ Found ${missingMigrations.length} migration(s) not in journal:`,
	);
	for (const m of missingMigrations) {
		console.log(`   - ${m.file}`);
	}

	console.log("📝 Marking missing migrations as applied...");
	for (const m of missingMigrations) {
		await client`
			INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
			VALUES (${m.hash}, ${Date.now()})
		`;
	}
	console.log(`✅ Marked ${missingMigrations.length} migration(s) as applied`);
};

const runPostgresMigrations = async () => {
	console.log("⏳ Running PostgreSQL migrations...");

	const connectionString = process.env.DATABASE_URL;

	if (!connectionString) {
		console.error("❌ DATABASE_URL is not defined");
		process.exit(1);
	}

	const client = postgres(connectionString);

	try {
		const migrationsFolder = path.join(
			process.cwd(),
			"packages/db/src/migrations",
		);
		console.log(`📂 Migrations folder: ${migrationsFolder}`);

		// First, sync the migration journal to handle db:push schema drift
		await syncMigrationJournal(client, migrationsFolder);

		const db = drizzle(client);
		const start = Date.now();

		await migrate(db, { migrationsFolder });
		const end = Date.now();
		console.log(`✅ PostgreSQL migrations completed in ${end - start}ms`);
	} catch (err) {
		// Handle schema drift errors gracefully
		if (
			isColumnAlreadyExistsError(err) ||
			isTableAlreadyExistsError(err) ||
			isConstraintAlreadyExistsError(err)
		) {
			console.log(
				"⚠️ Some schema elements already exist, this may indicate schema drift",
			);
			console.log("   Continuing with startup...");
			console.log(`   Error details: ${err.message || err}`);
		} else {
			console.error("❌ PostgreSQL migration failed");
			console.error(err);
			process.exit(1);
		}
	} finally {
		await client.end();
	}
};

const runClickHouseMigrations = async () => {
	console.log("⏳ Running ClickHouse migrations...");

	const clickhouseUrl = process.env.CLICKHOUSE_URL;

	if (!clickhouseUrl) {
		console.log(
			"⚠️ CLICKHOUSE_URL is not defined, skipping ClickHouse migrations",
		);
		return;
	}

	const clickhouse = createClient({
		url: clickhouseUrl,
		username: process.env.CLICKHOUSE_USER || "default",
		password: process.env.CLICKHOUSE_PASSWORD || "",
	});

	const start = Date.now();

	try {
		// Create database
		await clickhouse.command({
			query: "CREATE DATABASE IF NOT EXISTS uptimekit",
		});

		// Monitor Events Table
		await clickhouse.command({
			query: `
				CREATE TABLE IF NOT EXISTS uptimekit.monitor_events (
					id UUID,
					monitorId String,
					status String,
					latency UInt32,
					timestamp DateTime64(3),
					statusCode Nullable(UInt16),
					error Nullable(String),
					location Nullable(String),
					dnsLookup Nullable(UInt32),
					tcpConnect Nullable(UInt32),
					tlsHandshake Nullable(UInt32),
					ttfb Nullable(UInt32),
					transfer Nullable(UInt32)
				) ENGINE = MergeTree()
				ORDER BY (monitorId, timestamp)
			`,
		});

		// Monitor Changes Table
		await clickhouse.command({
			query: `
				CREATE TABLE IF NOT EXISTS uptimekit.monitor_changes (
					id UUID,
					monitorId String,
					status String,
					timestamp DateTime64(3),
					location Nullable(String)
				) ENGINE = MergeTree()
				ORDER BY (monitorId, timestamp)
			`,
		});

		const end = Date.now();
		console.log(`✅ ClickHouse migrations completed in ${end - start}ms`);
	} catch (err) {
		console.error("❌ ClickHouse migration failed");
		console.error(err);
		process.exit(1);
	} finally {
		await clickhouse.close();
	}
};

const seedDefaultConfiguration = async () => {
	console.log("⏳ Seeding default configuration...");

	const connectionString = process.env.DATABASE_URL;

	if (!connectionString) {
		console.error("❌ DATABASE_URL is not defined");
		process.exit(1);
	}

	const client = postgres(connectionString);

	const start = Date.now();

	const defaults = [
		{ key: "instance_name", value: "UptimeKit" },
		{ key: "data_retention_days", value: "30" },
	];

	try {
		for (const config of defaults) {
			await client`
				INSERT INTO configuration (id, key, value, created_at, updated_at)
				VALUES (gen_random_uuid(), ${config.key}, ${config.value}, NOW(), NOW())
				ON CONFLICT (key) DO NOTHING
			`;
		}
		const end = Date.now();
		console.log(`✅ Default configuration seeded in ${end - start}ms`);
	} catch (err) {
		console.error("❌ Configuration seeding failed");
		console.error(err);
	} finally {
		await client.end();
	}
};

const runMigrate = async () => {
	console.log("⏳ Starting migration script...");

	await runPostgresMigrations();
	await seedDefaultConfiguration();
	await runClickHouseMigrations();

	console.log("🎉 All migrations completed successfully!");
};

runMigrate();
