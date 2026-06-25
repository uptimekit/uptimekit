import { ORPCError } from "@orpc/server";
import { db } from "@uptimekit/db";
import { organization } from "@uptimekit/db/schema/auth";
import { integrationConfig } from "@uptimekit/db/schema/integrations";
import { monitorGroup } from "@uptimekit/db/schema/monitors";
import { tag } from "@uptimekit/db/schema/tags";
import { worker } from "@uptimekit/db/schema/workers";
import { and, eq, inArray } from "drizzle-orm";
import { insertMonitor } from "../../lib/insert-monitor";
import { getOrganizationQuotaState } from "../../lib/organization-limits";
import { importSourceRegistry } from "./registry";
import type { ImportedGroup, ImportedMonitor, ImportedTag } from "./types";

export function orderGroupsByDependency(
    groups: ImportedGroup[],
): ImportedGroup[] {
    const bySourceId = new Map(groups.map((g) => [g.sourceId, g]));
    const ordered: ImportedGroup[] = [];
    const visited = new Set<string>();

    const visit = (group: ImportedGroup) => {
        if (visited.has(group.sourceId)) return;
        visited.add(group.sourceId);
        const parent =
            group.sourceParentId != null
                ? bySourceId.get(group.sourceParentId)
                : undefined;
        if (parent) visit(parent);
        ordered.push(group);
    };

    for (const group of groups) visit(group);
    return ordered;
}

export function computeQuotaRemaining(
    activeMonitorLimit: number | null,
    activeMonitorCount: number,
): number | null {
    if (activeMonitorLimit === null) return null;
    return Math.max(0, activeMonitorLimit - activeMonitorCount);
}

export function selectNeededGroups(
    groups: ImportedGroup[],
    monitorGroupIds: (string | null | undefined)[],
): ImportedGroup[] {
    const bySourceId = new Map(groups.map((g) => [g.sourceId, g]));
    const needed = new Set<string>();

    for (const startId of monitorGroupIds) {
        let current: string | null = startId ?? null;
        while (current != null && !needed.has(current)) {
            const group = bySourceId.get(current);
            if (!group) break;
            needed.add(current);
            current = group.sourceParentId ?? null;
        }
    }

    return groups.filter((group) => needed.has(group.sourceId));
}

async function assertOrganizationExists(organizationId: string) {
    const org = await db.query.organization.findFirst({
        where: eq(organization.id, organizationId),
        columns: { id: true },
    });
    if (!org) {
        throw new ORPCError("NOT_FOUND", {
            message: "Organization not found.",
        });
    }
}

export async function previewImport(input: {
    sourceId: string;
    organizationId: string;
    connection: unknown;
}) {
    const source = importSourceRegistry.get(input.sourceId);
    if (!source) {
        throw new ORPCError("NOT_FOUND", { message: "Unknown import source." });
    }

    await assertOrganizationExists(input.organizationId);

    const connection = source.connectionSchema.parse(input.connection);
    const raw = await source.fetch(connection);
    const result = source.map(raw);

    const quotaState = await getOrganizationQuotaState(input.organizationId);

    const availableNotifications = await db
        .select({
            id: integrationConfig.id,
            name: integrationConfig.name,
            type: integrationConfig.type,
        })
        .from(integrationConfig)
        .where(
            and(
                eq(integrationConfig.organizationId, input.organizationId),
                eq(integrationConfig.active, true),
            ),
        );

    return {
        supported: result.monitors,
        skipped: result.skipped,
        groups: result.groups,
        tags: result.tags,
        quota: {
            limit: quotaState.activeMonitorLimit,
            used: quotaState.activeMonitorCount,
            remaining: computeQuotaRemaining(
                quotaState.activeMonitorLimit,
                quotaState.activeMonitorCount,
            ),
        },
        availableNotifications,
    };
}

export async function commitImport(input: {
    organizationId: string;
    workerIds: string[];
    notificationIds: string[];
    monitors: ImportedMonitor[];
    groups: ImportedGroup[];
    tags: ImportedTag[];
}) {
    await assertOrganizationExists(input.organizationId);

    const uniqueWorkerIds = [...new Set(input.workerIds)];
    let locations: string[] = [];
    if (uniqueWorkerIds.length > 0) {
        const workers = await db
            .select({ id: worker.id, location: worker.location })
            .from(worker)
            .where(
                and(
                    inArray(worker.id, uniqueWorkerIds),
                    eq(worker.active, true),
                ),
            );

        if (workers.length !== uniqueWorkerIds.length) {
            throw new ORPCError("BAD_REQUEST", {
                message:
                    "One or more selected workers are missing or inactive.",
            });
        }

        locations = [...new Set(workers.map((w) => w.location))];
    }

    const uniqueNotificationIds = [...new Set(input.notificationIds)];
    if (uniqueNotificationIds.length > 0) {
        const found = await db
            .select({ id: integrationConfig.id })
            .from(integrationConfig)
            .where(
                and(
                    eq(integrationConfig.organizationId, input.organizationId),
                    inArray(integrationConfig.id, uniqueNotificationIds),
                    eq(integrationConfig.active, true),
                ),
            );
        if (found.length !== uniqueNotificationIds.length) {
            throw new ORPCError("BAD_REQUEST", {
                message:
                    "One or more selected notifications are missing or inactive.",
            });
        }
    }

    const quotaState = await getOrganizationQuotaState(input.organizationId);
    if (
        quotaState.regionsPerMonitorLimit !== null &&
        uniqueWorkerIds.length > quotaState.regionsPerMonitorLimit
    ) {
        throw new ORPCError("FORBIDDEN", {
            message: `This organization allows at most ${quotaState.regionsPerMonitorLimit} region(s) per monitor.`,
        });
    }
    if (quotaState.activeMonitorLimit !== null) {
        const remaining = computeQuotaRemaining(
            quotaState.activeMonitorLimit,
            quotaState.activeMonitorCount,
        );
        if (remaining !== null && input.monitors.length > remaining) {
            throw new ORPCError("FORBIDDEN", {
                message: `This import would exceed the organization's active monitor limit by ${
                    input.monitors.length - remaining
                }. Deselect some monitors and try again.`,
            });
        }
    }

    const neededGroups = selectNeededGroups(
        input.groups,
        input.monitors.map((m) => m.sourceGroupId),
    );
    const orderedGroups = orderGroupsByDependency(neededGroups);
    const referencedTagNames = new Set(
        input.monitors.flatMap((m) => m.tagNames),
    );

    return db.transaction(async (tx) => {
        const groupIdBySourceId = new Map<string, string>();
        for (const group of orderedGroups) {
            const id = crypto.randomUUID();
            const parentId =
                group.sourceParentId != null
                    ? (groupIdBySourceId.get(group.sourceParentId) ?? null)
                    : null;

            await tx.insert(monitorGroup).values({
                id,
                organizationId: input.organizationId,
                name: group.name,
                parentId,
            });

            groupIdBySourceId.set(group.sourceId, id);
        }

        const existingTags = await tx
            .select({ id: tag.id, name: tag.name })
            .from(tag)
            .where(eq(tag.organizationId, input.organizationId));
        const tagIdByName = new Map(existingTags.map((t) => [t.name, t.id]));
        let tagsCreated = 0;

        for (const importedTag of input.tags) {
            if (!referencedTagNames.has(importedTag.name)) continue;
            if (tagIdByName.has(importedTag.name)) continue;

            const id = crypto.randomUUID();

            await tx.insert(tag).values({
                id,
                organizationId: input.organizationId,
                name: importedTag.name,
                color: importedTag.color,
            });

            tagIdByName.set(importedTag.name, id);
            tagsCreated += 1;
        }

        let created = 0;
        for (const m of input.monitors) {
            await insertMonitor(tx, {
                organizationId: input.organizationId,
                name: m.name,
                type: m.type,
                interval: m.interval,
                timeout: m.timeout,
                retries: m.retries,
                retryInterval: m.retryInterval,
                config: m.config,
                locations,
                workerIds: uniqueWorkerIds,
                groupId:
                    m.sourceGroupId != null
                        ? (groupIdBySourceId.get(m.sourceGroupId) ?? null)
                        : null,
                active: true,
                incidentPendingDuration: 0,
                incidentRecoveryDuration: 0,
                publishIncidentToStatusPage: false,
                tagIds: m.tagNames
                    .map((name) => tagIdByName.get(name))
                    .filter((id): id is string => Boolean(id)),
                notificationIds: uniqueNotificationIds,
            });
            created += 1;
        }

        return {
            created,
            groupsCreated: orderedGroups.length,
            tagsCreated,
        };
    });
}
