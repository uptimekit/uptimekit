import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type AppEventOutboxRow,
	claimPendingEvents,
	cleanupAppEventOutbox,
	ensureNotificationWorkerStarted,
	getNextRetryAt,
	markEventFailed,
	processAppEventRow,
	stopManagedNotificationWorker,
} from "../pkg/notifications/processor";

function buildRow(
	overrides: Partial<AppEventOutboxRow> = {},
): AppEventOutboxRow {
	const now = new Date("2026-06-01T10:00:00.000Z");

	return {
		id: "event-1",
		event_name: "incident.created",
		organization_id: "org-1",
		payload: {
			incidentId: "incident-1",
			organizationId: "org-1",
			title: "API down",
			severity: "major",
		},
		attempts: 1,
		created_at: now,
		available_at: now,
		...overrides,
	};
}

describe("notification outbox processor", () => {
	afterEach(async () => {
		await stopManagedNotificationWorker();
	});

	it("does not pass Date instances into raw Postgres queries", async () => {
		const sql = vi.fn(async () => []) as any;

		await claimPendingEvents({
			sql,
			workerId: "worker-1",
			staleProcessingMs: 300_000,
		});
		await markEventFailed(
			{
				id: "event-1",
				attempts: 1,
				error: new Error("failed"),
				now: new Date("2026-06-01T10:00:00.000Z"),
			},
			sql,
		);
		await cleanupAppEventOutbox({
			sql,
			now: new Date("2026-06-01T10:00:00.000Z"),
		});

		for (const call of sql.mock.calls) {
			for (const value of call.slice(1)) {
				expect(value).not.toBeInstanceOf(Date);
			}
		}
	});

	it("dispatches an event row and marks it processed", async () => {
		const dispatchEvent = vi.fn(async () => undefined);
		const markProcessed = vi.fn(async () => undefined);
		const markFailed = vi.fn(async () => undefined);

		await processAppEventRow(buildRow(), {
			dispatchEvent,
			markFailed,
			markProcessed,
		});

		expect(dispatchEvent).toHaveBeenCalledWith({
			id: "event-1",
			eventName: "incident.created",
			organizationId: "org-1",
			payload: {
				incidentId: "incident-1",
				organizationId: "org-1",
				title: "API down",
				severity: "major",
			},
			attempts: 1,
			createdAt: new Date("2026-06-01T10:00:00.000Z"),
			availableAt: new Date("2026-06-01T10:00:00.000Z"),
		});
		expect(markProcessed).toHaveBeenCalledWith("event-1");
		expect(markFailed).not.toHaveBeenCalled();
	});

	it("marks the row failed when dispatch throws", async () => {
		const error = new Error("webhook failed");
		const dispatchEvent = vi.fn(async () => {
			throw error;
		});
		const markProcessed = vi.fn(async () => undefined);
		const markFailed = vi.fn(async () => undefined);

		await processAppEventRow(buildRow({ attempts: 3 }), {
			dispatchEvent,
			markFailed,
			markProcessed,
			now: new Date("2026-06-01T10:00:00.000Z"),
		});

		expect(markProcessed).not.toHaveBeenCalled();
		expect(markFailed).toHaveBeenCalledWith({
			id: "event-1",
			attempts: 3,
			error,
			now: new Date("2026-06-01T10:00:00.000Z"),
		});
	});

	it("uses exponential retry delay capped at fifteen minutes", () => {
		const now = new Date("2026-06-01T10:00:00.000Z");

		expect(getNextRetryAt(1, now).toISOString()).toBe(
			"2026-06-01T10:00:30.000Z",
		);
		expect(getNextRetryAt(3, now).toISOString()).toBe(
			"2026-06-01T10:02:00.000Z",
		);
		expect(getNextRetryAt(10, now).toISOString()).toBe(
			"2026-06-01T10:15:00.000Z",
		);
	});

	it("starts a single managed Postgres listener and drains on notifications", async () => {
		let notify: (() => void) | undefined;
		const unlisten = vi.fn(async () => undefined);
		const sql = vi.fn(async () => []) as any;
		sql.listen = vi.fn(async (_channel, onNotify, onListen) => {
			notify = onNotify;
			onListen();
			return { unlisten };
		});

		const firstWorker = await ensureNotificationWorkerStarted({
			workerId: "worker-1",
			sql,
		});
		const secondWorker = await ensureNotificationWorkerStarted({
			workerId: "worker-2",
			sql,
		});

		expect(secondWorker).toBe(firstWorker);
		expect(sql.listen).toHaveBeenCalledTimes(1);

		const queryCountAfterStartup = sql.mock.calls.length;
		notify?.();

		await vi.waitFor(() => {
			expect(sql.mock.calls.length).toBeGreaterThan(queryCountAfterStartup);
		});
	});
});
