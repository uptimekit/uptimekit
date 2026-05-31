import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	execute: vi.fn(async () => undefined),
	insert: vi.fn(),
	values: vi.fn(async () => undefined),
}));

vi.mock("@uptimekit/db", () => {
	mocks.insert.mockReturnValue({ values: mocks.values });

	return {
		appEventOutbox: {},
		db: {
			execute: mocks.execute,
			insert: mocks.insert,
		},
	};
});

import { publishAppEvent } from "../lib/events";

describe("publishAppEvent", () => {
	beforeEach(() => {
		mocks.execute.mockClear();
		mocks.insert.mockClear();
		mocks.values.mockClear();
		mocks.insert.mockReturnValue({ values: mocks.values });
	});

	it("inserts an outbox row and notifies Postgres", async () => {
		await publishAppEvent(
			"incident.created",
			{
				incidentId: "incident-1",
				organizationId: "org-1",
				title: "API down",
				description: "The API is unavailable",
				severity: "major",
			},
			{ id: "event-1" },
		);

		expect(mocks.values).toHaveBeenCalledWith({
			id: "event-1",
			eventName: "incident.created",
			organizationId: "org-1",
			payload: {
				incidentId: "incident-1",
				organizationId: "org-1",
				title: "API down",
				description: "The API is unavailable",
				severity: "major",
			},
		});
		expect(mocks.execute).toHaveBeenCalledTimes(1);
	});

	it("uses the provided transaction client", async () => {
		const tx = {
			execute: vi.fn(async () => undefined),
			insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
		};

		await publishAppEvent(
			"incident.resolved",
			{
				incidentId: "incident-1",
				organizationId: "org-1",
				title: "API recovered",
				severity: "major",
			},
			{ id: "event-2", tx },
		);

		expect(tx.insert).toHaveBeenCalledTimes(1);
		expect(tx.execute).toHaveBeenCalledTimes(1);
		expect(mocks.insert).not.toHaveBeenCalled();
		expect(mocks.execute).not.toHaveBeenCalled();
	});
});
