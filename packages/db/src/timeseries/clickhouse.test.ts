import { createClient } from "@clickhouse/client";
import {
    GenericContainer,
    type StartedTestContainer,
    Wait,
} from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    ClickHouseDriver,
    supportsDeduplicatedAsyncInsert,
} from "./clickhouse";
import { defineDriverTests } from "./driver-suite";

const CONTAINER_TIMEOUT = 180_000;

let container: StartedTestContainer | undefined;
let driver: ClickHouseDriver | undefined;

function getClickHouseUrl() {
    if (!container) throw new Error("ClickHouse container failed to start");
    return `http://${container.getHost()}:${container.getMappedPort(8123)}`;
}

beforeAll(async () => {
    container = await new GenericContainer("clickhouse/clickhouse-server:26.9")
        .withExposedPorts(8123, 9000)
        .withEnvironment({
            CLICKHOUSE_DB: "default",
            CLICKHOUSE_USER: "default",
            CLICKHOUSE_PASSWORD: "test",
            CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: "1",
        })
        .withWaitStrategy(Wait.forHttp("/ping", 8123).forStatusCode(200))
        .withStartupTimeout(CONTAINER_TIMEOUT)
        .start();

    driver = new ClickHouseDriver({
        url: getClickHouseUrl(),
        username: "default",
        password: "test",
        asyncInsertBusyTimeoutMs: 200,
    });

    await driver.ensureSchema();
}, CONTAINER_TIMEOUT);

afterAll(async () => {
    await driver?.close();
    await container?.stop();
}, CONTAINER_TIMEOUT);

defineDriverTests("ClickHouseDriver", () => {
    if (!driver) throw new Error("ClickHouse container failed to start");
    return driver;
});

describe("ClickHouse async inserts", () => {
    it("enables async inserts only on versions with safe deduplication", () => {
        expect(supportsDeduplicatedAsyncInsert("26.9.1.1")).toBe(true);
        expect(supportsDeduplicatedAsyncInsert("26.8.2.5")).toBe(true);
        expect(supportsDeduplicatedAsyncInsert("27.1.1.1")).toBe(true);
        expect(supportsDeduplicatedAsyncInsert("26.7.3.1")).toBe(false);
        expect(supportsDeduplicatedAsyncInsert("25.12.1.1")).toBe(false);
        expect(supportsDeduplicatedAsyncInsert("")).toBe(false);
    });

    it("writes a batch of events into a few parts instead of one per row", async () => {
        if (!driver) throw new Error("ClickHouse container failed to start");
        const monitorId = `parts-${crypto.randomUUID()}`;
        const now = Date.now();

        await driver.insertMonitorEvents(
            Array.from({ length: 20 }, (_, index) => ({
                id: crypto.randomUUID(),
                monitorId,
                status: "up",
                latency: 100,
                timestamp: new Date(now - index * 1000),
            })),
        );

        const client = createClient({
            url: getClickHouseUrl(),
            username: "default",
            password: "test",
        });
        try {
            const result = await client.query({
                query: `
                    SELECT uniqExact(_part) AS parts, count() AS rows
                    FROM uptimekit.monitor_events
                    WHERE monitorId = {monitorId:String}
                `,
                query_params: { monitorId },
                format: "JSONEachRow",
            });
            const [row] = await result.json<{ parts: string; rows: string }>();

            expect(Number(row?.rows)).toBe(20);
            expect(Number(row?.parts)).toBeLessThanOrEqual(2);
        } finally {
            await client.close();
        }
    });
});
