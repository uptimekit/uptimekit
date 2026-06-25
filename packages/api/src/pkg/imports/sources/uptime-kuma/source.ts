import type { ImportSource } from "../../types";
import { fetchKumaMonitorList } from "./client";
import { mapKumaMonitorList } from "./mapper";
import { uptimeKumaMeta } from "./meta";
import type { KumaConnection, KumaMonitorList } from "./types";

export const uptimeKumaSource: ImportSource<KumaConnection> = {
    ...uptimeKumaMeta,
    fetch: (connection) => fetchKumaMonitorList(connection),
    map: (raw) => mapKumaMonitorList(raw as KumaMonitorList),
};
