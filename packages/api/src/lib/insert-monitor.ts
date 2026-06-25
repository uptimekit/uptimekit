import { ORPCError } from "@orpc/server";
import type { db } from "@uptimekit/db";
import { monitorNotification } from "@uptimekit/db/schema/integrations";
import { monitor } from "@uptimekit/db/schema/monitors";
import { monitorTag } from "@uptimekit/db/schema/tags";

type TransactionLike = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface InsertMonitorInput {
    organizationId: string;
    name: string;
    type: string;
    interval: number;
    timeout: number;
    retries: number;
    retryInterval: number;
    config: unknown;
    locations: string[];
    workerIds: string[];
    groupId: string | null;
    active: boolean;
    incidentPendingDuration: number;
    incidentRecoveryDuration: number;
    publishIncidentToStatusPage: boolean;
    tagIds: string[];
    notificationIds: string[];
}

export async function insertMonitor(
    tx: TransactionLike,
    input: InsertMonitorInput,
) {
    const [created] = await tx
        .insert(monitor)
        .values({
            id: crypto.randomUUID(),
            organizationId: input.organizationId,
            name: input.name,
            type: input.type,
            interval: input.interval,
            timeout: input.timeout,
            retries: input.retries,
            retryInterval: input.retryInterval,
            config: input.config,
            locations: input.locations,
            workerIds: input.workerIds,
            groupId: input.groupId,
            active: input.active,
            pauseReason: null,
            incidentPendingDuration: input.incidentPendingDuration,
            incidentRecoveryDuration: input.incidentRecoveryDuration,
            publishIncidentToStatusPage: input.publishIncidentToStatusPage,
        })
        .returning();

    if (!created) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    if (input.tagIds.length > 0) {
        await tx
            .insert(monitorTag)
            .values(
                input.tagIds.map((tagId) => ({ monitorId: created.id, tagId })),
            );
    }

    if (input.notificationIds.length > 0) {
        await tx.insert(monitorNotification).values(
            input.notificationIds.map((notificationId) => ({
                monitorId: created.id,
                integrationConfigId: notificationId,
            })),
        );
    }

    return created;
}
