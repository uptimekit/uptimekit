import { db } from "@uptimekit/db";
import { incident, incidentActivity } from "@uptimekit/db/schema/incidents";
import { and, eq, isNull, lte, ne } from "drizzle-orm";
import { createLogger } from "../lib/logger";

const logger = createLogger("MAINTENANCE");

/**
 * Automatically transition maintenance incidents based on their time window.
 */
export async function processMaintenanceTransitions() {
    const now = new Date();

    const scheduledToStart = await db.query.incident.findMany({
        where: and(
            eq(incident.severity, "maintenance"),
            ne(incident.status, "monitoring"),
            isNull(incident.endedAt),
            lte(incident.startedAt, now),
        ),
    });

    for (const m of scheduledToStart) {
        logger.info(`Starting: ${m.id} - ${m.title}`);

        await db.transaction(async (tx) => {
            await tx
                .update(incident)
                .set({
                    status: "monitoring",
                    updatedAt: now,
                })
                .where(eq(incident.id, m.id));

            await tx.insert(incidentActivity).values({
                id: crypto.randomUUID(),
                incidentId: m.id,
                message: "Maintenance has started automatically.",
                type: "event",
                createdAt: now,
                userId: null,
            });
        });

        logger.info(`Started: ${m.id}`);
    }

    const inProgressToComplete = await db.query.incident.findMany({
        where: and(
            eq(incident.severity, "maintenance"),
            isNull(incident.endedAt),
            lte(incident.plannedEndAt, now),
        ),
    });

    for (const m of inProgressToComplete) {
        logger.info(`Completing: ${m.id} - ${m.title}`);

        await db.transaction(async (tx) => {
            await tx
                .update(incident)
                .set({
                    status: "resolved",
                    endedAt: now,
                    resolvedAt: now,
                    updatedAt: now,
                })
                .where(eq(incident.id, m.id));

            await tx.insert(incidentActivity).values({
                id: crypto.randomUUID(),
                incidentId: m.id,
                message: "Maintenance has been completed automatically.",
                type: "event",
                createdAt: now,
                userId: null,
            });
        });

        logger.info(`Completed: ${m.id}`);
    }

    logger.info(
        `Processed: ${scheduledToStart.length} started, ${inProgressToComplete.length} completed`,
    );
}
