import { loadEnv } from "@uptimekit/config/env";

loadEnv();

import { type Job, Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { ensureConfiguration } from "./jobs/config-integrity";
import { processDataRetention } from "./jobs/data-retention";
import { processMaintenanceTransitions } from "./jobs/maintenance-processor";
import { processWorkerHealthCheck } from "./jobs/worker-health-check";
import { createLogger } from "./lib/logger";

const logger = createLogger("SCHEDULER");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Create Redis connection
const connection = new IORedis(REDIS_URL, {
	maxRetriesPerRequest: null,
});

// Create queues
const schedulerQueue = new Queue("scheduler", { connection });

// Job names
const JOBS = {
	MAINTENANCE_PROCESSOR: "maintenance-processor",
	DATA_RETENTION: "data-retention",
	WORKER_HEALTH_CHECK: "worker-health-check",
} as const;

// Create worker to process jobs
const worker = new Worker(
	"scheduler",
	async (job: Job) => {
		logger.info(`Processing job: ${job.name}`);

		try {
			switch (job.name) {
				case JOBS.MAINTENANCE_PROCESSOR:
					await processMaintenanceTransitions();
					break;
				case JOBS.DATA_RETENTION:
					await processDataRetention();
					break;
				case JOBS.WORKER_HEALTH_CHECK:
					await processWorkerHealthCheck();
					break;
				default:
					logger.warn(`Unknown job: ${job.name}`);
			}
			logger.info(`Job completed: ${job.name}`);
		} catch (error) {
			logger.error(`Job failed: ${job.name}`, error);
			throw error;
		}
	},
	{ connection },
);

// Handle worker events
worker.on("failed", (job: Job | undefined, err: Error) => {
	logger.error(`Job ${job?.name} failed:`, err);
});

worker.on("error", (err: Error) => {
	logger.error("Worker error:", err);
});

/**
 * Registers repeatable scheduler jobs used by the application.
 *
 * Registers a "maintenance-processor" job to run every minute and a "data-retention" job to run daily at 2:00 AM.
 */
async function registerJobs() {
	logger.info("Registering scheduler jobs...");

	// Maintenance processor - runs every minute
	await schedulerQueue.upsertJobScheduler(
		JOBS.MAINTENANCE_PROCESSOR,
		{ pattern: "* * * * *" }, // Every minute
		{
			name: JOBS.MAINTENANCE_PROCESSOR,
			data: {},
		},
	);
	logger.info("Registered: maintenance-processor (every minute)");

	// Data retention - runs daily at 2:00 AM
	await schedulerQueue.upsertJobScheduler(
		JOBS.DATA_RETENTION,
		{ pattern: "0 2 * * *" }, // Daily at 2:00 AM
		{
			name: JOBS.DATA_RETENTION,
			data: {},
		},
	);
	logger.info("Registered: data-retention (daily at 2:00 AM)");

	// Worker health check - runs every minute
	await schedulerQueue.upsertJobScheduler(
		JOBS.WORKER_HEALTH_CHECK,
		{ pattern: "* * * * *" }, // Every minute
		{
			name: JOBS.WORKER_HEALTH_CHECK,
			data: {},
		},
	);
	logger.info("Registered: worker-health-check (every minute)");

	logger.info("All scheduler jobs registered!");
}

/**
 * Initiates a graceful shutdown by closing the worker, the scheduler queue, and the Redis connection, then exits the process with code 0.
 *
 * Closes resources in sequence to finalize processing before terminating the process.
 */
async function shutdown() {
	logger.info("Shutting down scheduler...");
	await worker.close();
	await schedulerQueue.close();
	await connection.quit();
	process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start the scheduler
// Start the scheduler
ensureConfiguration()
	.then(() => registerJobs())
	.catch((err) => {
		logger.error("Failed to start scheduler:", err);
		process.exit(1);
	});

logger.info("Scheduler is running...");
