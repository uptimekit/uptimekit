import { loadEnv } from "@uptimekit/config/env";

loadEnv();

import { type Job, Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { ensureConfiguration } from "./jobs/config-integrity";
import { processDataRetention } from "./jobs/data-retention";
import { processMaintenanceTransitions } from "./jobs/maintenance-processor";
import { createLogger } from "./lib/logger";

const logger = createLogger("SCHEDULER");

// Job names
const JOBS = {
	MAINTENANCE_PROCESSOR: "maintenance-processor",
	DATA_RETENTION: "data-retention",
} as const;

let connection: IORedis | null = null;
let schedulerQueue: Queue | null = null;
let worker: Worker | null = null;

function getRequiredRedisUrl() {
	const redisUrl = process.env.REDIS_URL?.trim();

	if (!redisUrl) {
		throw new Error("REDIS_URL is not defined");
	}

	return redisUrl;
}

function describeRedisTarget(redisUrl: string) {
	try {
		const parsed = new URL(redisUrl);
		return `${parsed.protocol}//${parsed.host}`;
	} catch {
		return "<invalid REDIS_URL>";
	}
}

async function createRedisConnection() {
	const redisUrl = getRequiredRedisUrl();
	const redisTarget = describeRedisTarget(redisUrl);

	if (redisTarget === "<invalid REDIS_URL>") {
		throw new Error("REDIS_URL is not a valid URL");
	}

	const redis = new IORedis(redisUrl, {
		maxRetriesPerRequest: null,
		lazyConnect: true,
		enableOfflineQueue: false,
	});

	logger.info(`Connecting to Redis at ${redisTarget}`);

	try {
		await redis.connect();
		await redis.ping();
		logger.info(`Connected to Redis at ${redisTarget}`);
		return redis;
	} catch (error) {
		await redis.quit().catch(() => undefined);
		throw error;
	}
}

function createSchedulerWorker(connection: IORedis) {
	const schedulerQueue = new Queue("scheduler", { connection });
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

	worker.on("failed", (job: Job | undefined, err: Error) => {
		logger.error(`Job ${job?.name} failed:`, err);
	});

	worker.on("error", (err: Error) => {
		logger.error("Worker error:", err);
	});

	return { schedulerQueue, worker };
}

/**
 * Registers repeatable scheduler jobs used by the application.
 *
 * Registers a "maintenance-processor" job to run every minute and a "data-retention" job to run daily at 2:00 AM.
 */
async function registerJobs() {
	if (!schedulerQueue) {
		throw new Error("Scheduler queue is not initialized");
	}

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

	logger.info("All scheduler jobs registered!");
}

/**
 * Initiates a graceful shutdown by closing the worker, the scheduler queue, and the Redis connection, then exits the process with code 0.
 *
 * Closes resources in sequence to finalize processing before terminating the process.
 */
async function shutdown() {
	logger.info("Shutting down scheduler...");
	await worker?.close();
	await schedulerQueue?.close();
	await connection?.quit();
	process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

async function start() {
	connection = await createRedisConnection();

	const scheduler = createSchedulerWorker(connection);
	schedulerQueue = scheduler.schedulerQueue;
	worker = scheduler.worker;

	await ensureConfiguration();
	await registerJobs();

	logger.info("Scheduler is running...");
}

start().catch((err) => {
	logger.error("Failed to start scheduler:", err);
	process.exit(1);
});
