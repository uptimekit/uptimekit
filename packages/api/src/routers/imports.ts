import { z } from "zod";
import { adminProcedure } from "../index";
import { importSourceRegistry } from "../pkg/imports";
import { commitImport, previewImport } from "../pkg/imports/service";
import {
    importedGroupSchema,
    importedMonitorSchema,
    importedTagSchema,
} from "../pkg/imports/types";

export const importsRouter = {
    listSources: adminProcedure.handler(async () =>
        importSourceRegistry.list().map((source) => ({
            id: source.id,
            label: source.label,
            description: source.description,
            logo: source.logo,
        })),
    ),

    preview: adminProcedure
        .input(
            z.object({
                sourceId: z.string(),
                organizationId: z.string(),
                connection: z.record(z.string(), z.any()),
            }),
        )
        .handler(async ({ input }) => previewImport(input)),

    commit: adminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                workerIds: z.array(z.string()),
                notificationIds: z.array(z.string()),
                monitors: z.array(importedMonitorSchema),
                groups: z.array(importedGroupSchema),
                tags: z.array(importedTagSchema),
            }),
        )
        .handler(async ({ input }) =>
            commitImport({
                organizationId: input.organizationId,
                workerIds: input.workerIds,
                notificationIds: input.notificationIds,
                monitors: input.monitors.map((m) => ({
                    ...m,
                    sourceGroupId: m.sourceGroupId ?? null,
                })),
                groups: input.groups.map((g) => ({
                    ...g,
                    sourceParentId: g.sourceParentId ?? null,
                })),
                tags: input.tags,
            }),
        ),
};
