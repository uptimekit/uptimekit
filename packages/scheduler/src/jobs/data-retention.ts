import { clickhouse, db } from "@uptimekit/db";
import { configuration } from "@uptimekit/db/schema/configuration";
import { eq } from "drizzle-orm";
import { createLogger } from "../lib/logger";

const logger = createLogger("DATA-RETENTION");

/**
 * Delete records older than the configured `data_retention_days` from ClickHouse.
 *
 * Retrieves the `data_retention_days` configuration (defaults to 30 if absent) and deletes rows with a timestamp older than the computed cutoff from the `uptimekit.monitor_events` and `uptimekit.monitor_changes` tables. Logs progress and rethrows any error encountered during deletion.
 *
 * @throws The underlying error if any deletion command fails
 */
export async function processDataRetention() {
	// Get retention days from configuration
	const config = await db.query.configuration.findFirst({
		where: eq(configuration.key, "data_retention_days"),
	});

	const retentionDays = Number.parseInt(config?.value || "30", 10);
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

	logger.info(
		`Deleting records older than ${retentionDays} days (before ${cutoffDate.toISOString()})`,
	);

	try {
		// Delete old monitor events
		await clickhouse.command({
			query: `
				ALTER TABLE uptimekit.monitor_events 
				DELETE WHERE timestamp < toDateTime64({cutoff:String}, 3)
			`,
			query_params: { cutoff: cutoffDate.toISOString() },
		});
		logger.info("Deleted old monitor_events");

		// Delete old monitor changes
		await clickhouse.command({
			query: `
				ALTER TABLE uptimekit.monitor_changes 
				DELETE WHERE timestamp < toDateTime64({cutoff:String}, 3)
			`,
			query_params: { cutoff: cutoffDate.toISOString() },
		});
		logger.info("Deleted old monitor_changes");

		logger.info(
			`Completed data retention cleanup for records older than ${retentionDays} days`,
		);
	} catch (error) {
		logger.error("Failed to delete old records:", error);
		throw error;
	}
}