import { describe, expect, it } from "vitest";
import type { TimeSeriesDriver } from "./driver";

function uid(label: string) {
	return `${label}-${crypto.randomUUID()}`;
}

async function waitFor<T>(
	check: () => Promise<T>,
	predicate: (value: T) => boolean,
	timeoutMs = 10_000,
	intervalMs = 200,
) {
	const start = Date.now();
	let last: T | undefined;
	while (Date.now() - start < timeoutMs) {
		last = await check();
		if (predicate(last)) return last;
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}
	throw new Error(
		`Condition not met within ${timeoutMs}ms; last value: ${JSON.stringify(last)}`,
	);
}

export function defineDriverTests(
	name: string,
	getDriver: () => TimeSeriesDriver,
) {
	describe(name, () => {
		describe("ensureSchema", () => {
			it("is idempotent on repeated calls", async () => {
				await getDriver().ensureSchema();
				await getDriver().ensureSchema();
			});
		});

		describe("monitor events", () => {
			it("inserts a batch and reads back the most recent event", async () => {
				const driver = getDriver();
				const monitorId = uid("latest-event");
				const now = new Date();
				const earlier = new Date(now.getTime() - 60_000);

				await driver.insertMonitorEvents([
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 120,
						timestamp: earlier,
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "down",
						latency: 0,
						timestamp: now,
					},
				]);

				const latest = await driver.getLatestEventForMonitor(monitorId);

				expect(latest).toBeDefined();
				expect(latest?.status).toBe("down");
				expect(
					Math.abs((latest?.timestamp.getTime() ?? 0) - now.getTime()),
				).toBeLessThan(1000);
			});

			it("returns undefined when the monitor has no events", async () => {
				const latest = await getDriver().getLatestEventForMonitor(
					uid("no-events"),
				);

				expect(latest).toBeUndefined();
			});

			it("does nothing when called with an empty list", async () => {
				await getDriver().insertMonitorEvents([]);
			});

			it("returns the latest event per monitor in a batch query", async () => {
				const driver = getDriver();
				const monitorA = uid("batch-a");
				const monitorB = uid("batch-b");
				const now = new Date();

				await driver.insertMonitorEvents([
					{
						id: crypto.randomUUID(),
						monitorId: monitorA,
						status: "up",
						latency: 50,
						timestamp: new Date(now.getTime() - 120_000),
					},
					{
						id: crypto.randomUUID(),
						monitorId: monitorA,
						status: "degraded",
						latency: 800,
						timestamp: now,
					},
					{
						id: crypto.randomUUID(),
						monitorId: monitorB,
						status: "down",
						latency: 0,
						timestamp: new Date(now.getTime() - 30_000),
					},
				]);

				const latest = await driver.getLatestEventsForMonitors([
					monitorA,
					monitorB,
				]);

				const byMonitor = new Map(latest.map((row) => [row.monitorId, row]));
				expect(byMonitor.get(monitorA)?.status).toBe("degraded");
				expect(byMonitor.get(monitorB)?.status).toBe("down");
			});

			it("returns an empty array for batch queries with no monitor ids", async () => {
				const rows = await getDriver().getLatestEventsForMonitors([]);

				expect(rows).toEqual([]);
			});
		});

		describe("monitor changes", () => {
			it("inserts and reads back the most recent change", async () => {
				const driver = getDriver();
				const monitorId = uid("latest-change");
				const now = new Date();

				await driver.insertMonitorChanges([
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "down",
						timestamp: new Date(now.getTime() - 60_000),
						location: "us-east",
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						timestamp: now,
						location: "us-east",
					},
				]);

				const latest = await driver.getLatestChangeForMonitor(monitorId);

				expect(latest).toBeDefined();
				expect(
					Math.abs((latest?.timestamp.getTime() ?? 0) - now.getTime()),
				).toBeLessThan(1000);
			});

			it("returns the latest change per monitor in a batch query", async () => {
				const driver = getDriver();
				const monitorA = uid("change-batch-a");
				const monitorB = uid("change-batch-b");
				const now = new Date();

				await driver.insertMonitorChanges([
					{
						id: crypto.randomUUID(),
						monitorId: monitorA,
						status: "down",
						timestamp: new Date(now.getTime() - 90_000),
					},
					{
						id: crypto.randomUUID(),
						monitorId: monitorA,
						status: "up",
						timestamp: now,
					},
					{
						id: crypto.randomUUID(),
						monitorId: monitorB,
						status: "down",
						timestamp: new Date(now.getTime() - 30_000),
					},
				]);

				const latest = await driver.getLatestChangesForMonitors([
					monitorA,
					monitorB,
				]);

				const byMonitor = new Map(latest.map((row) => [row.monitorId, row]));
				expect(byMonitor.get(monitorA)).toBeDefined();
				expect(byMonitor.get(monitorB)).toBeDefined();
				expect(
					Math.abs(
						(byMonitor.get(monitorA)?.timestamp.getTime() ?? 0) - now.getTime(),
					),
				).toBeLessThan(1000);
			});

			it("paginates the change timeline using the cursor", async () => {
				const driver = getDriver();
				const monitorId = uid("timeline");
				const base = Date.now();

				const inserts = Array.from({ length: 5 }, (_, index) => ({
					id: crypto.randomUUID(),
					monitorId,
					status: index % 2 === 0 ? "up" : "down",
					timestamp: new Date(base - index * 60_000),
				}));

				await driver.insertMonitorChanges(inserts);

				const firstPage = await driver.getChangeTimeline({
					monitorId,
					limit: 3,
				});

				expect(firstPage).toHaveLength(3);
				const firstHead = firstPage[0];
				const firstTail = firstPage[2];
				if (!firstHead || !firstTail)
					throw new Error("missing first page rows");
				expect(firstHead.timestamp.getTime()).toBeGreaterThanOrEqual(
					firstTail.timestamp.getTime(),
				);

				const secondPage = await driver.getChangeTimeline({
					monitorId,
					limit: 3,
					cursorBefore: firstTail.timestamp,
				});

				expect(secondPage.length).toBeGreaterThan(0);
				const secondHead = secondPage[0];
				if (!secondHead) throw new Error("missing second page rows");
				expect(secondHead.timestamp.getTime()).toBeLessThan(
					firstTail.timestamp.getTime(),
				);
			});
		});

		describe("aggregations", () => {
			it("computes the average latency over a time window", async () => {
				const driver = getDriver();
				const monitorId = uid("avg-latency");
				const now = new Date();

				await driver.insertMonitorEvents([
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 100,
						timestamp: new Date(now.getTime() - 30_000),
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 200,
						timestamp: new Date(now.getTime() - 15_000),
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 300,
						timestamp: now,
					},
				]);

				const avg = await driver.getAverageLatency(
					monitorId,
					new Date(now.getTime() - 60_000),
				);

				expect(Math.round(avg)).toBe(200);
			});

			it("excludes events outside the time window from the average", async () => {
				const driver = getDriver();
				const monitorId = uid("avg-window");
				const now = new Date();

				await driver.insertMonitorEvents([
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 1000,
						timestamp: new Date(now.getTime() - 24 * 60 * 60_000),
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 50,
						timestamp: now,
					},
				]);

				const avg = await driver.getAverageLatency(
					monitorId,
					new Date(now.getTime() - 60_000),
				);

				expect(Math.round(avg)).toBe(50);
			});

			it("counts status codes over a time window", async () => {
				const driver = getDriver();
				const monitorId = uid("status-codes");
				const now = new Date();

				await driver.insertMonitorEvents([
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 100,
						timestamp: new Date(now.getTime() - 120_000),
						statusCode: 404,
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 100,
						timestamp: new Date(now.getTime() - 45_000),
						statusCode: 200,
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 120,
						timestamp: new Date(now.getTime() - 30_000),
						statusCode: 200,
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "down",
						latency: 0,
						timestamp: new Date(now.getTime() - 15_000),
						statusCode: 500,
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "down",
						latency: 0,
						timestamp: now,
						statusCode: null,
					},
				]);

				const statusCodes = await driver.getStatusCodeDistribution({
					monitorId,
					since: new Date(now.getTime() - 60_000),
				});

				expect(statusCodes).toEqual([
					{ statusCode: 200, count: 2 },
					{ statusCode: 500, count: 1 },
				]);
			});

			it("buckets hourly uptime stats", async () => {
				const driver = getDriver();
				const monitorId = uid("hourly");
				const anchor = new Date();
				anchor.setUTCMinutes(30, 0, 0);

				await driver.insertMonitorEvents([
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 100,
						timestamp: new Date(anchor.getTime() - 10 * 60_000),
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "down",
						latency: 0,
						timestamp: new Date(anchor.getTime() - 5 * 60_000),
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 200,
						timestamp: anchor,
					},
				]);

				const stats = await driver.getHourlyUptimeStats(
					monitorId,
					new Date(anchor.getTime() - 60 * 60_000),
				);

				const bucket = stats[0];
				expect(bucket).toBeDefined();
				if (!bucket) return;
				expect(bucket.totalChecks).toBe(3);
				expect(bucket.upChecks).toBe(2);
				expect(Math.round(bucket.avgLatency)).toBe(100);
			});
		});

		describe("response times", () => {
			it("returns events ordered ascending and filtered by since", async () => {
				const driver = getDriver();
				const monitorId = uid("response-times");
				const now = new Date();

				await driver.insertMonitorEvents([
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 100,
						timestamp: new Date(now.getTime() - 90_000),
						location: "eu-west",
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 150,
						timestamp: new Date(now.getTime() - 45_000),
						location: "us-east",
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 200,
						timestamp: now,
						location: "eu-west",
					},
				]);

				const all = await driver.getResponseTimes({
					monitorId,
					since: new Date(now.getTime() - 60_000),
				});

				expect(all).toHaveLength(2);
				const [a, b] = all;
				if (!a || !b) throw new Error("missing response time rows");
				expect(a.timestamp.getTime()).toBeLessThan(b.timestamp.getTime());
			});

			it("filters by location", async () => {
				const driver = getDriver();
				const monitorId = uid("response-locations");
				const now = new Date();

				await driver.insertMonitorEvents([
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 100,
						timestamp: now,
						location: "eu-west",
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 200,
						timestamp: now,
						location: "us-east",
					},
				]);

				const filtered = await driver.getResponseTimes({
					monitorId,
					since: new Date(now.getTime() - 60_000),
					locations: ["eu-west"],
				});

				expect(filtered).toHaveLength(1);
				expect(filtered[0]?.location).toBe("eu-west");
			});

			it("supports capped and uncapped response time queries", async () => {
				const driver = getDriver();
				const monitorId = uid("response-limit");
				const now = new Date();

				await driver.insertMonitorEvents([
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 100,
						timestamp: new Date(now.getTime() - 120_000),
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 125,
						timestamp: new Date(now.getTime() - 60_000),
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 150,
						timestamp: now,
					},
				]);

				const capped = await driver.getResponseTimes({
					monitorId,
					since: new Date(now.getTime() - 180_000),
					limit: 1,
				});
				const uncapped = await driver.getResponseTimes({
					monitorId,
					since: new Date(now.getTime() - 180_000),
					limit: null,
				});

				expect(capped).toHaveLength(1);
				expect(uncapped).toHaveLength(3);
			});

			it("keeps the most recent events when the limit caps the result", async () => {
				const driver = getDriver();
				const monitorId = uid("response-recent");
				const now = new Date();

				await driver.insertMonitorEvents([
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 100,
						timestamp: new Date(now.getTime() - 120_000),
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 150,
						timestamp: new Date(now.getTime() - 60_000),
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 200,
						timestamp: now,
					},
				]);

				const capped = await driver.getResponseTimes({
					monitorId,
					since: new Date(now.getTime() - 180_000),
					limit: 2,
				});

				expect(capped.map((point) => point.latency)).toEqual([150, 200]);
			});

			it("keeps the most recent events per location when filtered and capped", async () => {
				const driver = getDriver();
				const monitorId = uid("response-recent-locations");
				const now = new Date();

				await driver.insertMonitorEvents([
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 10,
						timestamp: new Date(now.getTime() - 250_000),
						location: "worker-a",
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 20,
						timestamp: new Date(now.getTime() - 200_000),
						location: "worker-b",
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 30,
						timestamp: new Date(now.getTime() - 150_000),
						location: "worker-a",
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 40,
						timestamp: new Date(now.getTime() - 100_000),
						location: "worker-b",
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 50,
						timestamp: new Date(now.getTime() - 50_000),
						location: "worker-a",
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 60,
						timestamp: new Date(now.getTime() - 30_000),
						location: "worker-b",
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 999,
						timestamp: now,
						location: "worker-c",
					},
				]);

				const capped = await driver.getResponseTimes({
					monitorId,
					since: new Date(now.getTime() - 300_000),
					locations: ["worker-a", "worker-b"],
					limit: 4,
				});

				expect(capped.map((point) => point.latency)).toEqual([30, 40, 50, 60]);
				expect(capped.map((point) => point.location)).toEqual([
					"worker-a",
					"worker-b",
					"worker-a",
					"worker-b",
				]);
			});

			it("returns bucketed response times across the full range without applying the raw cap", async () => {
				const driver = getDriver();
				const monitorId = uid("response-buckets");
				const now = new Date("2026-06-03T12:00:00.000Z");

				await driver.insertMonitorEvents([
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 100,
						timestamp: new Date("2026-06-01T12:00:00.000Z"),
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 200,
						timestamp: new Date("2026-06-02T12:00:00.000Z"),
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 300,
						timestamp: now,
					},
				]);

				const buckets = await driver.getResponseTimes({
					monitorId,
					since: new Date("2026-06-01T00:00:00.000Z"),
					bucketSeconds: 24 * 60 * 60,
					bucketQuantile: 0.5,
					limit: 1,
				});

				expect(buckets.map((point) => point.latency)).toEqual([100, 200, 300]);
			});

			it("keeps separate bucketed series when grouped by location", async () => {
				const driver = getDriver();
				const monitorId = uid("response-location-buckets");

				await driver.insertMonitorEvents([
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 100,
						timestamp: new Date("2026-06-03T12:00:00.000Z"),
						location: "worker-a",
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 200,
						timestamp: new Date("2026-06-03T12:00:00.000Z"),
						location: "worker-b",
					},
				]);

				const buckets = await driver.getResponseTimes({
					monitorId,
					since: new Date("2026-06-03T00:00:00.000Z"),
					locations: ["worker-a", "worker-b"],
					bucketSeconds: 60 * 60,
					bucketQuantile: 0.5,
					groupByLocation: true,
				});

				expect(buckets).toHaveLength(2);
				expect(buckets.map((point) => point.location)).toEqual([
					"worker-a",
					"worker-b",
				]);
				expect(buckets.map((point) => point.latency)).toEqual([100, 200]);
			});
		});

		describe("worker status snapshots", () => {
			it("returns the most recent event per location", async () => {
				const driver = getDriver();
				const monitorId = uid("worker-status");
				const now = new Date();

				await driver.insertMonitorEvents([
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 100,
						timestamp: new Date(now.getTime() - 60_000),
						location: "worker-a",
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "down",
						latency: 0,
						timestamp: now,
						location: "worker-a",
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 50,
						timestamp: now,
						location: "worker-b",
					},
				]);

				const statuses = await driver.getLatestStatusPerLocation(monitorId);

				const byLocation = new Map(statuses.map((row) => [row.location, row]));
				expect(byLocation.get("worker-a")?.status).toBe("down");
				expect(byLocation.get("worker-b")?.status).toBe("up");
			});
		});

		describe("recent latencies", () => {
			it("returns the most recent N latencies per monitor", async () => {
				const driver = getDriver();
				const monitorId = uid("sparkline");
				const base = Date.now();

				const inserts = Array.from({ length: 25 }, (_, index) => ({
					id: crypto.randomUUID(),
					monitorId,
					status: "up",
					latency: index,
					timestamp: new Date(base - index * 1000),
				}));

				await driver.insertMonitorEvents(inserts);

				const recent = await driver.getRecentLatenciesByMonitor(
					[monitorId],
					10,
				);

				expect(recent).toHaveLength(10);
				expect(recent.every((point) => point.monitorId === monitorId)).toBe(
					true,
				);
			});

			it("averages latency across workers per round", async () => {
				const driver = getDriver();
				const monitorId = uid("sparkline-multi-worker");
				const base = Date.now();

				const rounds = 3;
				const inserts = Array.from({ length: rounds }, (_, round) => [
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 100,
						timestamp: new Date(base - round * 1000),
						location: "worker-a",
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 300,
						timestamp: new Date(base - round * 1000 - 100),
						location: "worker-b",
					},
				]).flat();

				await driver.insertMonitorEvents(inserts);

				const recent = await driver.getRecentLatenciesByMonitor(
					[monitorId],
					10,
				);

				expect(recent).toHaveLength(rounds);
				expect(recent.every((point) => point.latency === 200)).toBe(true);
			});

			it("does not add a spurious point when a worker misses a round", async () => {
				const driver = getDriver();
				const monitorId = uid("sparkline-missed-round");
				const base = Date.now();

				await driver.insertMonitorEvents([
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 100,
						timestamp: new Date(base),
						location: "worker-a",
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 100,
						timestamp: new Date(base - 1000),
						location: "worker-a",
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 100,
						timestamp: new Date(base - 2000),
						location: "worker-a",
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 300,
						timestamp: new Date(base - 50),
						location: "worker-b",
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 300,
						timestamp: new Date(base - 1050),
						location: "worker-b",
					},
				]);

				const recent = await driver.getRecentLatenciesByMonitor(
					[monitorId],
					10,
				);

				expect(recent.map((point) => point.latency)).toEqual([100, 200, 200]);
			});
		});

		describe("deletions", () => {
			it("clears every event and change for a monitor", async () => {
				const driver = getDriver();
				const monitorId = uid("delete-monitor");
				const now = new Date();

				await driver.insertMonitorEvents([
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 100,
						timestamp: now,
					},
				]);
				await driver.insertMonitorChanges([
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						timestamp: now,
					},
				]);

				expect(await driver.getLatestEventForMonitor(monitorId)).toBeDefined();

				await driver.deleteAllForMonitor(monitorId);

				await waitFor(
					() => driver.getLatestEventForMonitor(monitorId),
					(row) => row === undefined,
				);
				await waitFor(
					() => driver.getLatestChangeForMonitor(monitorId),
					(row) => row === undefined,
				);
			});

			it("deletes only rows older than the cutoff", async () => {
				const driver = getDriver();
				const monitorId = uid("delete-old");
				const now = new Date();
				const old = new Date(now.getTime() - 7 * 24 * 60 * 60_000);

				await driver.insertMonitorEvents([
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 100,
						timestamp: old,
					},
					{
						id: crypto.randomUUID(),
						monitorId,
						status: "up",
						latency: 200,
						timestamp: now,
					},
				]);

				const cutoff = new Date(now.getTime() - 24 * 60 * 60_000);
				await driver.deleteOlderThan(cutoff);

				const remaining = await waitFor(
					() =>
						driver.getResponseTimes({
							monitorId,
							since: new Date(0),
						}),
					(rows) => rows.length === 1,
				);

				expect(remaining).toHaveLength(1);
				expect(remaining[0]?.latency).toBe(200);
			});
		});
	});
}
