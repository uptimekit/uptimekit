import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	handler: vi.fn(async () => undefined),
	incidentMonitors: [] as Array<{ monitorId: string }>,
	assignedConfigs: [] as Array<{ config: Record<string, unknown> }>,
	defaultConfigs: [] as Array<Record<string, unknown>>,
}));

vi.mock("@uptimekit/db", () => ({
	db: {
		query: {
			incident: {
				findFirst: vi.fn(async () => ({ organizationId: "org-1" })),
			},
			integrationConfig: {
				findMany: vi.fn(async () => mocks.defaultConfigs),
			},
		},
		select: vi.fn(() => {
			let joined = false;

			return {
				from: () => ({
					innerJoin: () => {
						joined = true;
						return {
							where: async () => mocks.assignedConfigs,
						};
					},
					where: async () =>
						joined ? mocks.assignedConfigs : mocks.incidentMonitors,
				}),
			};
		}),
	},
}));

import type { PersistedAppEvent } from "../../lib/events";
import { integrationRegistry } from "./registry";
import { dedupeNotificationConfigs, IntegrationService } from "./service";

describe("notification config selection", () => {
	beforeEach(() => {
		mocks.handler.mockClear();
		mocks.incidentMonitors = [];
		mocks.assignedConfigs = [];
		mocks.defaultConfigs = [];
	});

	it("deduplicates configs assigned through multiple monitors", () => {
		const first = { id: "notification-1", name: "Primary" };
		const second = { id: "notification-2", name: "Secondary" };
		const duplicate = { id: "notification-1", name: "Duplicate" };

		expect(dedupeNotificationConfigs([first, second, duplicate])).toEqual([
			first,
			second,
		]);
	});

	it("sends incident events to notification configs assigned to the incident monitor", async () => {
		mocks.incidentMonitors = [{ monitorId: "monitor-1" }];
		mocks.assignedConfigs = [
			{
				config: {
					id: "config-1",
					type: "test-monitor-assigned",
					config: { url: "https://example.com/webhook" },
				},
			},
		];

		integrationRegistry.register({
			id: "test-monitor-assigned",
			name: "Test Monitor Assigned",
			type: "export",
			description: "Test integration",
			configSchema: { parse: (value: unknown) => value } as any,
			events: ["incident.created"],
			handler: mocks.handler,
		});

		const service = new IntegrationService();
		const event: PersistedAppEvent<"incident.created"> = {
			id: "event-1",
			eventName: "incident.created",
			organizationId: "org-1",
			payload: {
				incidentId: "incident-1",
				organizationId: "org-1",
				title: "Monitor is down",
				severity: "major",
			},
			attempts: 1,
			createdAt: new Date("2026-06-01T10:00:00.000Z"),
			availableAt: new Date("2026-06-01T10:00:00.000Z"),
		};

		await service.handleAppEvent(event);

		expect(mocks.handler).toHaveBeenCalledWith(
			{ url: "https://example.com/webhook" },
			"incident.created",
			event.payload,
		);
	});
});
