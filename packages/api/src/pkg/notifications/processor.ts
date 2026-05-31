import { postgresClient } from "@uptimekit/db";
import {
	APP_EVENT_CHANNEL,
	type AppEventName,
	type AppEvents,
	type PersistedAppEvent,
} from "../../lib/events";
import { createLogger } from "../../lib/logger";
import { handleIntegrationEvent } from "../integrations/service";
import { handleSubscriberEvent } from "../subscribers/service";

const logger = createLogger("NOTIFICATIONS");

export const MAX_EVENT_ATTEMPTS = 5;
export const STALE_PROCESSING_MS = 5 * 60 * 1000;
export const SWEEP_INTERVAL_MS = 30_000;
const MAX_RETRY_DELAY_MS = 15 * 60 * 1000;
const BASE_RETRY_DELAY_MS = 30_000;
const DEFAULT_BATCH_SIZE = 25;

export interface AppEventOutboxRow {
	id: string;
	event_name: AppEventName;
	organization_id: string;
	payload: unknown;
	attempts: number;
	created_at: Date;
	available_at: Date;
}

type NotificationSqlClient = typeof postgresClient;

interface ProcessAppEventRowDependencies {
	dispatchEvent?: (event: PersistedAppEvent) => Promise<void>;
	markProcessed?: (id: string) => Promise<void>;
	markFailed?: (input: {
		id: string;
		attempts: number;
		error: unknown;
		now?: Date;
	}) => Promise<void>;
	now?: Date;
}

interface ManagedNotificationWorkerState {
	worker?: PostgresNotificationWorker;
	startPromise?: Promise<PostgresNotificationWorker>;
}

const managedNotificationWorkerKey = Symbol.for(
	"uptimekit.managedNotificationWorker",
);

function getManagedNotificationWorkerState() {
	const globalForWorker = globalThis as typeof globalThis &
		Record<symbol, ManagedNotificationWorkerState | undefined>;

	globalForWorker[managedNotificationWorkerKey] ??= {};
	return globalForWorker[managedNotificationWorkerKey];
}

export function getNextRetryAt(attempts: number, now = new Date()) {
	const delayMs = getRetryDelayMs(attempts);

	return new Date(now.getTime() + delayMs);
}

function getRetryDelayMs(attempts: number) {
	return Math.min(
		MAX_RETRY_DELAY_MS,
		BASE_RETRY_DELAY_MS * 2 ** Math.max(attempts - 1, 0),
	);
}

export function mapOutboxRowToEvent(row: AppEventOutboxRow): PersistedAppEvent {
	return {
		id: row.id,
		eventName: row.event_name,
		organizationId: row.organization_id,
		payload: row.payload as AppEvents[AppEventName],
		attempts: row.attempts,
		createdAt: row.created_at,
		availableAt: row.available_at,
	};
}

export async function dispatchPersistedAppEvent(event: PersistedAppEvent) {
	const results = await Promise.allSettled([
		handleIntegrationEvent(event),
		handleSubscriberEvent(event),
	]);

	const failures = results.filter((result) => result.status === "rejected");
	if (failures.length === 0) {
		return;
	}

	throw new AggregateError(
		failures.map((failure) => failure.reason),
		`Failed to process event ${event.id}`,
	);
}

export async function claimPendingEvents(input: {
	sql?: NotificationSqlClient;
	workerId: string;
	batchSize?: number;
	staleProcessingMs?: number;
}) {
	const sql = input.sql ?? postgresClient;
	const batchSize = input.batchSize ?? DEFAULT_BATCH_SIZE;
	const staleProcessingMs = input.staleProcessingMs ?? STALE_PROCESSING_MS;

	return sql<AppEventOutboxRow[]>`
		with next_events as (
			select id
			from app_event_outbox
			where (
				status = 'pending'
				and available_at <= now()
			) or (
				status = 'processing'
				and locked_at < now() - (${staleProcessingMs} * interval '1 millisecond')
			)
			order by available_at asc, created_at asc
			limit ${batchSize}
			for update skip locked
		)
		update app_event_outbox event
		set
			status = 'processing',
			attempts = event.attempts + 1,
			locked_at = now(),
			locked_by = ${input.workerId},
			updated_at = now()
		from next_events
		where event.id = next_events.id
		returning
			event.id,
			event.event_name,
			event.organization_id,
			event.payload,
			event.attempts,
			event.created_at,
			event.available_at
	`;
}

export async function markEventProcessed(
	id: string,
	sql: NotificationSqlClient = postgresClient,
) {
	await sql`
		update app_event_outbox
		set
			status = 'processed',
			processed_at = now(),
			locked_at = null,
			locked_by = null,
			last_error = null,
			updated_at = now()
		where id = ${id}
	`;
}

export async function markEventFailed(
	input: {
		id: string;
		attempts: number;
		error: unknown;
		now?: Date;
	},
	sql: NotificationSqlClient = postgresClient,
) {
	const errorMessage =
		input.error instanceof Error ? input.error.message : String(input.error);

	if (input.attempts >= MAX_EVENT_ATTEMPTS) {
		await sql`
			update app_event_outbox
			set
				status = 'failed',
				locked_at = null,
				locked_by = null,
				last_error = ${errorMessage},
				updated_at = now()
			where id = ${input.id}
		`;
		return;
	}

	await sql`
		update app_event_outbox
		set
			status = 'pending',
			available_at = now() + (${getRetryDelayMs(input.attempts)} * interval '1 millisecond'),
			locked_at = null,
			locked_by = null,
			last_error = ${errorMessage},
			updated_at = now()
		where id = ${input.id}
	`;
}

export async function processAppEventRow(
	row: AppEventOutboxRow,
	deps: ProcessAppEventRowDependencies = {},
) {
	const event = mapOutboxRowToEvent(row);
	const dispatchEvent = deps.dispatchEvent ?? dispatchPersistedAppEvent;
	const markProcessed = deps.markProcessed ?? markEventProcessed;
	const markFailed =
		deps.markFailed ??
		((input) =>
			markEventFailed({
				...input,
				now: deps.now,
			}));

	try {
		await dispatchEvent(event);
		await markProcessed(row.id);
	} catch (error) {
		logger.error(`Failed to process app event ${row.id}`, error);
		await markFailed({
			id: row.id,
			attempts: row.attempts,
			error,
			now: deps.now,
		});
	}
}

export async function drainPendingEvents(input: {
	workerId: string;
	sql?: NotificationSqlClient;
	batchSize?: number;
}) {
	const sql = input.sql ?? postgresClient;
	let processed = 0;

	while (true) {
		const rows = await claimPendingEvents({
			sql,
			workerId: input.workerId,
			batchSize: input.batchSize,
		});

		if (rows.length === 0) {
			return processed;
		}

		for (const row of rows) {
			await processAppEventRow(row, {
				markFailed: (failure) => markEventFailed(failure, sql),
				markProcessed: (id) => markEventProcessed(id, sql),
			});
			processed++;
		}
	}
}

export async function cleanupAppEventOutbox(
	input: {
		processedOlderThanDays?: number;
		failedOlderThanDays?: number;
		sql?: NotificationSqlClient;
	} = {},
) {
	const sql = input.sql ?? postgresClient;
	const processedOlderThanDays = input.processedOlderThanDays ?? 7;
	const failedOlderThanDays = input.failedOlderThanDays ?? 30;

	await sql`
		delete from app_event_outbox
		where (
			status = 'processed'
			and processed_at < now() - (${processedOlderThanDays} * interval '1 day')
		) or (
			status = 'failed'
			and updated_at < now() - (${failedOlderThanDays} * interval '1 day')
		)
	`;
}

export class PostgresNotificationWorker {
	private readonly workerId: string;
	private readonly sql: NotificationSqlClient;
	private sweepInterval: ReturnType<typeof setInterval> | undefined;
	private unlisten: (() => Promise<void>) | undefined;
	private drainPromise: Promise<void> | undefined;

	constructor(input: { workerId?: string; sql?: NotificationSqlClient } = {}) {
		this.workerId =
			input.workerId ??
			`notifications-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
		this.sql = input.sql ?? postgresClient;
	}

	async start() {
		if (this.sweepInterval || this.unlisten) {
			return;
		}

		const listener = await this.sql.listen(
			APP_EVENT_CHANNEL,
			() => void this.drain(),
			() => logger.info(`Listening for ${APP_EVENT_CHANNEL}`),
		);
		this.unlisten = () => listener.unlisten();

		this.sweepInterval = setInterval(
			() => void this.drain(),
			SWEEP_INTERVAL_MS,
		);
		this.sweepInterval.unref?.();

		await this.drain();
	}

	async drain() {
		if (this.drainPromise) {
			return this.drainPromise;
		}

		this.drainPromise = drainPendingEvents({
			workerId: this.workerId,
			sql: this.sql,
		})
			.then((count) => {
				if (count > 0) {
					logger.info(`Processed ${count} app event${count === 1 ? "" : "s"}`);
				}
			})
			.catch((error) => {
				logger.error("Failed to drain app events", error);
			})
			.finally(() => {
				this.drainPromise = undefined;
			});

		return this.drainPromise;
	}

	async stop() {
		if (this.sweepInterval) {
			clearInterval(this.sweepInterval);
			this.sweepInterval = undefined;
		}

		if (this.unlisten) {
			await this.unlisten();
			this.unlisten = undefined;
		}

		if (this.drainPromise) {
			await this.drainPromise;
		}
	}
}

export async function startNotificationWorker() {
	const worker = new PostgresNotificationWorker();
	await worker.start();
	return worker;
}

export async function ensureNotificationWorkerStarted(
	input: { workerId?: string; sql?: NotificationSqlClient } = {},
) {
	const state = getManagedNotificationWorkerState();

	if (state.worker) {
		return state.worker;
	}

	if (state.startPromise) {
		return state.startPromise;
	}

	const worker = new PostgresNotificationWorker(input);
	state.startPromise = worker
		.start()
		.then(() => {
			state.worker = worker;
			logger.info("Postgres notification worker started");
			return worker;
		})
		.catch((error) => {
			state.startPromise = undefined;
			throw error;
		});

	return state.startPromise;
}

export async function stopManagedNotificationWorker() {
	const state = getManagedNotificationWorkerState();

	if (state.worker) {
		await state.worker.stop();
	}

	state.worker = undefined;
	state.startPromise = undefined;
}

export async function processPendingNotifications(source = "api-inline") {
	await drainPendingEvents({
		workerId: `${source}-${process.pid}`,
	});
}
