import { timeseries } from "@uptimekit/db";
import { type AppEventWriteClient, publishAppEvent } from "../../lib/events";
import type {
    MonitorTimeseriesOutboxPayload,
    MonitorTimeseriesPersistencePayload,
} from "./timeseries-payload";

export async function persistMonitorTimeseriesPayload(
    payload: MonitorTimeseriesPersistencePayload,
) {
    if (payload.changesToInsert.length > 0) {
        await timeseries.insertMonitorChanges(
            payload.changesToInsert.map((change) => ({
                ...change,
                timestamp: new Date(change.timestamp),
            })),
        );
    }

    if (payload.monitorEvents.length > 0) {
        await timeseries.insertMonitorEvents(
            payload.monitorEvents.map((event) => ({
                ...event,
                timestamp: new Date(event.timestamp),
            })),
        );
    }
}

export async function enqueueMonitorTimeseriesPersistence(
    payload: MonitorTimeseriesOutboxPayload,
    options: { tx?: AppEventWriteClient } = {},
) {
    return publishAppEvent("monitor.timeseries.persist", payload, {
        tx: options.tx,
    });
}
