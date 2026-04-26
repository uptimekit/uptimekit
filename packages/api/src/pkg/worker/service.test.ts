import { describe, expect, it } from "bun:test";
import {
	getConfiguredWorkerStates,
	isAutomaticIncidentOpenEligible,
	isAutomaticIncidentResolveEligible,
	type MonitorEvent,
} from "./service";

function toMap(
	entries: Array<[string, { status: MonitorEvent["status"]; timestamp: Date }]>,
) {
	return new Map(entries);
}

describe("worker automatic incident gating", () => {
	it("opens for a single worker when the pending duration is satisfied", () => {
		const workerStatusById = toMap([
			[
				"worker-a",
				{ status: "down", timestamp: new Date("2026-04-26T10:00:00Z") },
			],
		]);

		const result = isAutomaticIncidentOpenEligible({
			configuredWorkerIds: ["worker-a"],
			workerStatusById,
			activeIncident: undefined,
			eventTime: new Date("2026-04-26T10:00:30Z"),
			incidentPendingDurationSeconds: 30,
		});

		expect(result.eligible).toBe(true);
		expect(result.allWorkersDownSince?.toISOString()).toBe(
			"2026-04-26T10:00:00.000Z",
		);
	});

	it("does not open when only some assigned workers are down", () => {
		const workerStatusById = toMap([
			[
				"worker-a",
				{ status: "down", timestamp: new Date("2026-04-26T10:00:00Z") },
			],
			[
				"worker-b",
				{ status: "up", timestamp: new Date("2026-04-26T10:00:00Z") },
			],
		]);

		const result = isAutomaticIncidentOpenEligible({
			configuredWorkerIds: ["worker-a", "worker-b"],
			workerStatusById,
			activeIncident: undefined,
			eventTime: new Date("2026-04-26T10:00:45Z"),
			incidentPendingDurationSeconds: 0,
		});

		expect(result.eligible).toBe(false);
		expect(result.allWorkersDownSince).toBeNull();
	});

	it("opens only after every assigned worker is down", () => {
		const workerStatusById = toMap([
			[
				"worker-a",
				{ status: "down", timestamp: new Date("2026-04-26T10:00:00Z") },
			],
			[
				"worker-b",
				{ status: "down", timestamp: new Date("2026-04-26T10:00:15Z") },
			],
			[
				"worker-c",
				{ status: "up", timestamp: new Date("2026-04-26T10:00:30Z") },
			],
		]);

		const beforeFinalFailure = isAutomaticIncidentOpenEligible({
			configuredWorkerIds: ["worker-a", "worker-b", "worker-c"],
			workerStatusById,
			activeIncident: undefined,
			eventTime: new Date("2026-04-26T10:00:30Z"),
			incidentPendingDurationSeconds: 0,
		});

		expect(beforeFinalFailure.eligible).toBe(false);

		workerStatusById.set("worker-c", {
			status: "down",
			timestamp: new Date("2026-04-26T10:00:45Z"),
		});

		const afterFinalFailure = isAutomaticIncidentOpenEligible({
			configuredWorkerIds: ["worker-a", "worker-b", "worker-c"],
			workerStatusById,
			activeIncident: undefined,
			eventTime: new Date("2026-04-26T10:00:45Z"),
			incidentPendingDurationSeconds: 0,
		});

		expect(afterFinalFailure.eligible).toBe(true);
		expect(afterFinalFailure.allWorkersDownSince?.toISOString()).toBe(
			"2026-04-26T10:00:45.000Z",
		);
	});

	it("does not open until every assigned worker has reported at least once", () => {
		const configuredWorkerStates = getConfiguredWorkerStates(
			["worker-a", "worker-b"],
			toMap([
				[
					"worker-a",
					{ status: "down", timestamp: new Date("2026-04-26T10:00:00Z") },
				],
			]),
		);

		expect(configuredWorkerStates.allWorkersReporting).toBe(false);
		expect(configuredWorkerStates.states).toHaveLength(1);
	});

	it("measures pending duration from the last worker to fail", () => {
		const workerStatusById = toMap([
			[
				"worker-a",
				{ status: "down", timestamp: new Date("2026-04-26T10:00:00Z") },
			],
			[
				"worker-b",
				{ status: "down", timestamp: new Date("2026-04-26T10:00:25Z") },
			],
		]);

		const tooEarly = isAutomaticIncidentOpenEligible({
			configuredWorkerIds: ["worker-a", "worker-b"],
			workerStatusById,
			activeIncident: undefined,
			eventTime: new Date("2026-04-26T10:00:29Z"),
			incidentPendingDurationSeconds: 5,
		});

		expect(tooEarly.eligible).toBe(false);
		expect(tooEarly.allWorkersDownSince?.toISOString()).toBe(
			"2026-04-26T10:00:25.000Z",
		);

		const onTime = isAutomaticIncidentOpenEligible({
			configuredWorkerIds: ["worker-a", "worker-b"],
			workerStatusById,
			activeIncident: undefined,
			eventTime: new Date("2026-04-26T10:00:30Z"),
			incidentPendingDurationSeconds: 5,
		});

		expect(onTime.eligible).toBe(true);
	});

	it("resolves when any assigned worker clears", () => {
		const result = isAutomaticIncidentResolveEligible({
			configuredWorkerIds: ["worker-a", "worker-b"],
			workerStatusById: toMap([
				[
					"worker-a",
					{ status: "down", timestamp: new Date("2026-04-26T10:00:00Z") },
				],
				[
					"worker-b",
					{ status: "up", timestamp: new Date("2026-04-26T10:00:05Z") },
				],
			]),
			activeIncident: { id: "incident-1" },
		});

		expect(result).toBe(true);
	});

	it("does not emit duplicate openings while the same outage remains active", () => {
		const configuredWorkerIds = ["worker-a", "worker-b"];
		const workerStatusById = new Map<
			string,
			{ status: MonitorEvent["status"]; timestamp: Date }
		>();
		const openedAt: string[] = [];
		let activeIncident: { id: string } | undefined;

		const batch = [
			{
				workerId: "worker-a",
				status: "down",
				timestamp: new Date("2026-04-26T10:00:00Z"),
			},
			{
				workerId: "worker-b",
				status: "down",
				timestamp: new Date("2026-04-26T10:00:02Z"),
			},
			{
				workerId: "worker-a",
				status: "down",
				timestamp: new Date("2026-04-26T10:00:03Z"),
			},
			{
				workerId: "worker-b",
				status: "down",
				timestamp: new Date("2026-04-26T10:00:04Z"),
			},
		] as const;

		for (const event of batch) {
			workerStatusById.set(event.workerId, {
				status: event.status,
				timestamp: event.timestamp,
			});

			if (
				isAutomaticIncidentResolveEligible({
					configuredWorkerIds,
					workerStatusById,
					activeIncident,
				})
			) {
				activeIncident = undefined;
				continue;
			}

			const openEvaluation = isAutomaticIncidentOpenEligible({
				configuredWorkerIds,
				workerStatusById,
				activeIncident,
				eventTime: event.timestamp,
				incidentPendingDurationSeconds: 0,
			});

			if (openEvaluation.eligible) {
				openedAt.push(event.timestamp.toISOString());
				activeIncident = { id: `incident-${openedAt.length}` };
			}
		}

		expect(openedAt).toEqual(["2026-04-26T10:00:02.000Z"]);
	});

	it("treats maintenance as a non-down state so it cannot trigger an outage open", () => {
		const result = isAutomaticIncidentOpenEligible({
			configuredWorkerIds: ["worker-a", "worker-b"],
			workerStatusById: toMap([
				[
					"worker-a",
					{
						status: "maintenance",
						timestamp: new Date("2026-04-26T10:00:00Z"),
					},
				],
				[
					"worker-b",
					{ status: "down", timestamp: new Date("2026-04-26T10:00:00Z") },
				],
			]),
			activeIncident: undefined,
			eventTime: new Date("2026-04-26T10:00:30Z"),
			incidentPendingDurationSeconds: 0,
		});

		expect(result.eligible).toBe(false);
	});
});
