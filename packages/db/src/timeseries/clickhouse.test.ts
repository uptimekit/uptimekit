import {
    GenericContainer,
    type StartedTestContainer,
    Wait,
} from "testcontainers";
import { afterAll, beforeAll } from "vitest";
import { ClickHouseDriver } from "./clickhouse";
import { defineDriverTests } from "./driver-suite";

const CONTAINER_TIMEOUT = 180_000;

let container: StartedTestContainer | undefined;
let driver: ClickHouseDriver | undefined;

beforeAll(async () => {
    container = await new GenericContainer(
        "clickhouse/clickhouse-server:latest",
    )
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
        url: `http://${container.getHost()}:${container.getMappedPort(8123)}`,
        username: "default",
        password: "test",
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
