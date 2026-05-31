import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	handleIntegrationEvent: vi.fn(async () => undefined),
	handleSubscriberEvent: vi.fn(async () => undefined),
}));

vi.mock("../pkg/integrations/service", () => ({
	handleIntegrationEvent: mocks.handleIntegrationEvent,
}));

vi.mock("../pkg/subscribers/service", () => ({
	handleSubscriberEvent: mocks.handleSubscriberEvent,
}));

import { dispatchPersistedAppEvent } from "../pkg/notifications/processor";

describe("notification dispatch", () => {
	it("triggers notification handlers for persisted app events", async () => {
		const event = {
			id: "event-1",
			eventName: "incident.created",
			organizationId: "org-1",
			payload: {
				incidentId: "incident-1",
				organizationId: "org-1",
				title: "Monitor down",
				severity: "major",
			},
			attempts: 1,
			createdAt: new Date("2026-06-01T10:00:00.000Z"),
			availableAt: new Date("2026-06-01T10:00:00.000Z"),
		} as const;

		await dispatchPersistedAppEvent(event);

		expect(mocks.handleIntegrationEvent).toHaveBeenCalledWith(event);
		expect(mocks.handleSubscriberEvent).toHaveBeenCalledWith(event);
	});
});
