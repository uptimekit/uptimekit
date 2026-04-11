import fs from "node:fs";
import path from "node:path";

import { createClient } from "@clickhouse/client";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const isColumnAlreadyExistsError = (error: unknown) => {
	const errorStr =
		error instanceof Error ? error.toString() : String(error ?? "");

	return (
		(typeof error === "object" &&
			error !== null &&
			("code" in error ? error.code === "42701" : false)) ||
		("cause" in (error as Record<string, unknown>)
			? (error as { cause?: { code?: string } }).cause?.code === "42701"
			: false) ||
		(errorStr.includes("42701") && errorStr.includes("already exists"))
	);
};

const isTableAlreadyExistsError = (error: unknown) => {
	const errorStr =
		error instanceof Error ? error.toString() : String(error ?? "");

	return (
		(typeof error === "object" &&
			error !== null &&
			("code" in error ? error.code === "42P07" : false)) ||
		("cause" in (error as Record<string, unknown>)
			? (error as { cause?: { code?: string } }).cause?.code === "42P07"
			: false) ||
		(errorStr.includes("42P07") && errorStr.includes("already exists"))
	);
};

const isConstraintAlreadyExistsError = (error: unknown) => {
	const errorStr =
		error instanceof Error ? error.toString() : String(error ?? "");

	return (
		(typeof error === "object" &&
			error !== null &&
			("code" in error ? error.code === "42710" : false)) ||
		("cause" in (error as Record<string, unknown>)
			? (error as { cause?: { code?: string } }).cause?.code === "42710"
			: false) ||
		(errorStr.includes("42710") && errorStr.includes("already exists"))
	);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getMigrationFiles = (migrationsFolder: string) => {
	const migrations = readMigrationFiles({ migrationsFolder });
	const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
	const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
		entries: Array<{ tag: string; when: number }>;
	};

	return journal.entries.map((entry, index) => ({
		file: `${entry.tag}.sql`,
		hash: migrations[index]?.hash ?? "",
		folderMillis: entry.when,
	}));
};

const ensureMigrationJournal = async (client: ReturnType<typeof postgres>) => {
	await client`CREATE SCHEMA IF NOT EXISTS drizzle`;
	await client`
		CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
			id SERIAL PRIMARY KEY,
			hash text NOT NULL,
			created_at bigint
		)
	`;
};

const hasExistingApplicationTables = async (
	client: ReturnType<typeof postgres>,
) => {
	const result = await client`
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.tables
			WHERE table_schema = 'public'
				AND table_type = 'BASE TABLE'
		) AS exists
	`;

	return result[0]?.exists === true;
};

const waitForPostgres = async (
	client: ReturnType<typeof postgres>,
	maxAttempts = 30,
	delayMs = 2000,
) => {
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			await client`SELECT 1`;
			if (attempt > 1) {
				console.log(`✅ PostgreSQL became ready after ${attempt} attempts`);
			}
			return;
		} catch (error) {
			if (attempt === maxAttempts) {
				throw error;
			}

			console.log(`⏳ Waiting for PostgreSQL... (${attempt}/${maxAttempts})`);
			await sleep(delayMs);
		}
	}
};

const waitForClickHouse = async (
	clickhouse: ReturnType<typeof createClient>,
	maxAttempts = 30,
	delayMs = 2000,
) => {
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			await clickhouse.command({
				query: "SELECT 1",
			});
			if (attempt > 1) {
				console.log(`✅ ClickHouse became ready after ${attempt} attempts`);
			}
			return;
		} catch (error) {
			if (attempt === maxAttempts) {
				throw error;
			}

			console.log(`⏳ Waiting for ClickHouse... (${attempt}/${maxAttempts})`);
			await sleep(delayMs);
		}
	}
};

const syncMigrationJournal = async (
	client: ReturnType<typeof postgres>,
	migrationsFolder: string,
) => {
	console.log("🔄 Checking migration journal...");

	await ensureMigrationJournal(client);

	const migrationFiles = getMigrationFiles(migrationsFolder);
	const hasAppTables = await hasExistingApplicationTables(client);
	const appliedMigrations = await client`
		SELECT hash FROM drizzle.__drizzle_migrations
	`;
	const appliedHashes = new Set(
		appliedMigrations.map((migration) => migration.hash),
	);

	if (!hasAppTables && appliedMigrations.length === 0) {
		console.log("✅ Fresh database detected, running migrations normally");
		return;
	}

	const missingMigrations = migrationFiles.filter(
		(migration) => !appliedHashes.has(migration.hash),
	);

	if (missingMigrations.length === 0) {
		console.log("✅ All migrations are already recorded");
		return;
	}

	console.log(
		`⚠️ Found ${missingMigrations.length} migration(s) not in journal:`,
	);
	for (const migration of missingMigrations) {
		console.log(`   - ${migration.file}`);
	}

	console.log("📝 Marking missing migrations as applied...");
	for (const migration of missingMigrations) {
		await client`
			INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
			VALUES (${migration.hash}, ${migration.folderMillis})
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
		await waitForPostgres(client);

		const migrationsFolder = path.join(
			process.cwd(),
			"packages/db/src/migrations",
		);
		console.log(`📂 Migrations folder: ${migrationsFolder}`);

		await syncMigrationJournal(client, migrationsFolder);

		const db = drizzle(client);
		const start = Date.now();

		await migrate(db, { migrationsFolder });
		const end = Date.now();
		console.log(`✅ PostgreSQL migrations completed in ${end - start}ms`);
	} catch (error) {
		if (
			isColumnAlreadyExistsError(error) ||
			isTableAlreadyExistsError(error) ||
			isConstraintAlreadyExistsError(error)
		) {
			console.log(
				"⚠️ Some schema elements already exist, this may indicate schema drift",
			);
			console.log("   Continuing with startup...");
			console.log(
				`   Error details: ${error instanceof Error ? error.message : String(error)}`,
			);
		} else {
			console.error("❌ PostgreSQL migration failed");
			console.error(error);
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
		await waitForClickHouse(clickhouse);

		await clickhouse.command({
			query: "CREATE DATABASE IF NOT EXISTS uptimekit",
		});

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
	} catch (error) {
		console.error("❌ ClickHouse migration failed");
		console.error(error);
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
	} catch (error) {
		console.error("❌ Configuration seeding failed");
		console.error(error);
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

await runMigrate();
