import { db } from "@uptimekit/db";
import { worker } from "@uptimekit/db/schema/workers";
import { and, eq, gte, isNull, lt, or } from "drizzle-orm";
import { createLogger } from "../lib/logger";

const logger = createLogger("WORKER-HEALTH");

/**
 * Check worker health and mark workers offline if no heartbeat for 2 minutes.
 * Also auto-recover workers that have reconnected.
 */
export async function processWorkerHealthCheck() {
	const now = new Date();
	const thresholdMs = 2 * 60 * 1000; // 2 minutes
	const cutoffTime = new Date(now.getTime() - thresholdMs);

	// Find active workers with stale heartbeats (mark offline)
	const workersToMarkOffline = await db.query.worker.findMany({
		where: and(
			eq(worker.active, true),
			or(isNull(worker.lastHeartbeat), lt(worker.lastHeartbeat, cutoffTime)),
		),
	});

	for (const w of workersToMarkOffline) {
		await db
			.update(worker)
			.set({ active: false, updatedAt: now })
			.where(eq(worker.id, w.id));

		logger.info(`Marked offline: ${w.name} (${w.id})`);
	}

	// Find inactive workers with recent heartbeats (mark online)
	const workersToMarkOnline = await db.query.worker.findMany({
		where: and(eq(worker.active, false), gte(worker.lastHeartbeat, cutoffTime)),
	});

	for (const w of workersToMarkOnline) {
		await db
			.update(worker)
			.set({ active: true, updatedAt: now })
			.where(eq(worker.id, w.id));

		logger.info(`Marked online: ${w.name} (${w.id})`);
	}

	logger.info(
		`Health check complete: ${workersToMarkOffline.length} offline, ${workersToMarkOnline.length} online`,
	);
}
