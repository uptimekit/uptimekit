const path = require("path");
// Manually add root node_modules to require path if needed, though NODE_PATH should handle it.
// Let's try to resolve from absolute path if possible or verify paths.
const { drizzle } = require("drizzle-orm/node-postgres");
const { migrate } = require("drizzle-orm/node-postgres/migrator");
const { Pool } = require("pg");

const runMigrate = async () => {
	console.log("⏳ Starting migration script...");

	const connectionString = process.env.DATABASE_URL;

	if (!connectionString) {
		console.error("❌ DATABASE_URL is not defined");
		process.exit(1);
	}

	const pool = new Pool({
		connectionString,
	});

	const db = drizzle(pool);

	console.log("⏳ Running migrations...");

	const start = Date.now();

	try {
		// Use absolute path for migrations folder based on CWD or __dirname
		// If we run from /app, and file is in /app/packages/db/src/migrate.cjs
		// Migrations are in /app/packages/db/src/migrations
		const migrationsFolder = path.join(
			process.cwd(),
			"packages/db/src/migrations",
		);
		console.log(`📂 Migrations folder: ${migrationsFolder}`);

		await migrate(db, { migrationsFolder });
		const end = Date.now();
		console.log(`✅ Migrations completed in ${end - start}ms`);
	} catch (err) {
		console.error("❌ Migration failed");
		console.error(err);
		process.exit(1);
	} finally {
		await pool.end();
	}
};

runMigrate();
