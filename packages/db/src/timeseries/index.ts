import { ClickHouseDriver } from "./clickhouse";
import type { TimeSeriesBackend, TimeSeriesDriver } from "./driver";
import { TimescaleDriver } from "./timescale";

export { ClickHouseDriver } from "./clickhouse";
export type { TimeSeriesBackend, TimeSeriesDriver } from "./driver";
export { TimescaleDriver } from "./timescale";
export type * from "./types";

export function resolveTimeSeriesBackend(): TimeSeriesBackend {
    const raw = (process.env.TIMESERIES_BACKEND ?? "clickhouse")
        .trim()
        .toLowerCase();
    if (raw === "clickhouse" || raw === "timescale") {
        return raw;
    }
    throw new Error(
        `Invalid TIMESERIES_BACKEND="${process.env.TIMESERIES_BACKEND}". Expected "clickhouse" or "timescale".`,
    );
}

export function createTimeSeriesDriver(
    backend: TimeSeriesBackend = resolveTimeSeriesBackend(),
): TimeSeriesDriver {
    switch (backend) {
        case "clickhouse":
            return new ClickHouseDriver();
        case "timescale":
            return new TimescaleDriver();
        default:
            return new TimescaleDriver();
    }
}
