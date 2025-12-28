import { db } from "@uptimekit/db";
import { maintenance, maintenanceUpdate } from "@uptimekit/db/schema/maintenance";
import { and, eq, lte } from "drizzle-orm";
import { createLogger } from "../lib/logger";

const logger = createLogger("MAINTENANCE");

/**
 * Process maintenance status transitions:
 * - scheduled → in_progress when startAt <= NOW()
 * - in_progress → completed when endAt <= NOW()
 */
export async function processMaintenanceTransitions() {
    const now = new Date();

    // Find all scheduled maintenance that should be in_progress
    const scheduledToStart = await db.query.maintenance.findMany({
        where: and(
            eq(maintenance.status, "scheduled"),
            lte(maintenance.startAt, now),
        ),
    });

    for (const m of scheduledToStart) {
        logger.info(`Starting: ${m.id} - ${m.title}`);

        await db.transaction(async (tx) => {
            // Update maintenance status
            await tx
                .update(maintenance)
                .set({
                    status: "in_progress",
                    updatedAt: now,
                })
                .where(eq(maintenance.id, m.id));

            // Create automatic update entry
            await tx.insert(maintenanceUpdate).values({
                id: crypto.randomUUID(),
                maintenanceId: m.id,
                message: "Maintenance has started automatically.",
                status: "in_progress",
                createdAt: now,
                updatedAt: now,
            });
        });

        logger.info(`Started: ${m.id}`);
    }

    // Find all in_progress maintenance that should be completed
    const inProgressToComplete = await db.query.maintenance.findMany({
        where: and(
            eq(maintenance.status, "in_progress"),
            lte(maintenance.endAt, now),
        ),
    });

    for (const m of inProgressToComplete) {
        logger.info(`Completing: ${m.id} - ${m.title}`);

        await db.transaction(async (tx) => {
            // Update maintenance status
            await tx
                .update(maintenance)
                .set({
                    status: "completed",
                    updatedAt: now,
                })
                .where(eq(maintenance.id, m.id));

            // Create automatic update entry
            await tx.insert(maintenanceUpdate).values({
                id: crypto.randomUUID(),
                maintenanceId: m.id,
                message: "Maintenance has been completed automatically.",
                status: "completed",
                createdAt: now,
                updatedAt: now,
            });
        });

        logger.info(`Completed: ${m.id}`);
    }

    logger.info(
        `Processed: ${scheduledToStart.length} started, ${inProgressToComplete.length} completed`,
    );
}

