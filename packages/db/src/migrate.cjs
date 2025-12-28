const path = require("path");
// Manually add root node_modules to require path if needed, though NODE_PATH should handle it.
// Let's try to resolve from absolute path if possible or verify paths.
const { drizzle } = require("drizzle-orm/node-postgres");
const { migrate } = require("drizzle-orm/node-postgres/migrator");
const { Pool } = require("pg");
const { createClient } = require("@clickhouse/client");

const runPostgresMigrations = async () => {
	console.log("⏳ Running PostgreSQL migrations...");

	const connectionString = process.env.DATABASE_URL;

	if (!connectionString) {
		console.error("❌ DATABASE_URL is not defined");
		process.exit(1);
	}

	const pool = new Pool({
		connectionString,
	});

	const db = drizzle(pool);

	const start = Date.now();

	try {
		const migrationsFolder = path.join(
			process.cwd(),
			"packages/db/src/migrations",
		);
		console.log(`📂 Migrations folder: ${migrationsFolder}`);

		await migrate(db, { migrationsFolder });
		const end = Date.now();
		console.log(`✅ PostgreSQL migrations completed in ${end - start}ms`);
	} catch (err) {
		console.error("❌ PostgreSQL migration failed");
		console.error(err);
		process.exit(1);
	} finally {
		await pool.end();
	}
};

const runClickHouseMigrations = async () => {
	console.log("⏳ Running ClickHouse migrations...");

	const clickhouseUrl = process.env.CLICKHOUSE_URL;

	if (!clickhouseUrl) {
		console.log("⚠️ CLICKHOUSE_URL is not defined, skipping ClickHouse migrations");
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

const runMigrate = async () => {
	console.log("⏳ Starting migration script...");

	await runPostgresMigrations();
	await seedDefaultConfiguration();
	await runClickHouseMigrations();

	console.log("🎉 All migrations completed successfully!");
};

const seedDefaultConfiguration = async () => {
	console.log("⏳ Seeding default configuration...");

	const connectionString = process.env.DATABASE_URL;

	if (!connectionString) {
		console.error("❌ DATABASE_URL is not defined");
		process.exit(1);
	}

	const pool = new Pool({
		connectionString,
	});

	const start = Date.now();

	const defaults = [
		{ key: "instance_name", value: "UptimeKit" },
		{ key: "data_retention_days", value: "30" },
	];

	try {
		for (const config of defaults) {
			// Use INSERT ... ON CONFLICT to upsert (only insert if not exists)
			await pool.query(
				`INSERT INTO configuration (id, key, value, created_at, updated_at)
				 VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
				 ON CONFLICT (key) DO NOTHING`,
				[config.key, config.value]
			);
		}
		const end = Date.now();
		console.log(`✅ Default configuration seeded in ${end - start}ms`);
	} catch (err) {
		console.error("❌ Configuration seeding failed");
		console.error(err);
		// Don't exit - seeding is not critical
	} finally {
		await pool.end();
	}
};

runMigrate();
