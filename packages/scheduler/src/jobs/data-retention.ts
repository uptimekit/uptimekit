import { cleanupAppEventOutbox } from "@uptimekit/api/pkg/notifications";
import { db, timeseries } from "@uptimekit/db";
import { configuration } from "@uptimekit/db/schema/configuration";
import { eq } from "drizzle-orm";
import { createLogger } from "../lib/logger";

const logger = createLogger("DATA-RETENTION");

/**
 * Delete records older than the configured `data_retention_days` from the
 * time-series store (ClickHouse or TimescaleDB depending on `TIMESERIES_BACKEND`).
 */
export async function processDataRetention() {
	const config = await db.query.configuration.findFirst({
		where: eq(configuration.key, "data_retention_days"),
	});

	const retentionDays = Number.parseInt(config?.value || "30", 10);
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

	logger.info(
		`Scheduling deletion of records older than ${retentionDays} days (before ${cutoffDate.toISOString()})`,
	);

	try {
		await timeseries.deleteOlderThan(cutoffDate);
		await cleanupAppEventOutbox();
		// Note: on the ClickHouse backend `ALTER TABLE … DELETE` is an asynchronous
		// lightweight mutation, so rows may still be physically present for a short
		// window after this returns. Timescale deletes synchronously.
		logger.info(
			`Submitted data retention cleanup for records older than ${retentionDays} days`,
		);
	} catch (error) {
		logger.error("Failed to delete old records:", error);
		throw error;
	}
}
