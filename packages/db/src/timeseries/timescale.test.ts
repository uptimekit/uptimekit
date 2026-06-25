import {
    GenericContainer,
    type StartedTestContainer,
    Wait,
} from "testcontainers";
import { afterAll, beforeAll } from "vitest";
import { defineDriverTests } from "./driver-suite";
import { TimescaleDriver } from "./timescale";

const CONTAINER_TIMEOUT = 180_000;

let container: StartedTestContainer | undefined;
let driver: TimescaleDriver | undefined;

beforeAll(async () => {
    container = await new GenericContainer("timescale/timescaledb:2.27.1-pg18")
        .withExposedPorts(5432)
        .withEnvironment({
            POSTGRES_USER: "test",
            POSTGRES_PASSWORD: "test",
            POSTGRES_DB: "test",
        })
        .withWaitStrategy(
            Wait.forLogMessage(
                /database system is ready to accept connections/,
                2,
            ),
        )
        .withStartupTimeout(CONTAINER_TIMEOUT)
        .start();

    driver = new TimescaleDriver({
        url: `postgres://test:test@${container.getHost()}:${container.getMappedPort(5432)}/test`,
    });

    await driver.ensureSchema();
}, CONTAINER_TIMEOUT);

afterAll(async () => {
    await driver?.close();
    await container?.stop();
}, CONTAINER_TIMEOUT);

defineDriverTests("TimescaleDriver", () => {
    if (!driver) throw new Error("Timescale container failed to start");
    return driver;
});
