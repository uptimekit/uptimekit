import { db } from "@uptimekit/db";
import { configuration, CONFIG_DEFAULTS } from "@uptimekit/db/schema/configuration";
import { eq } from "drizzle-orm";
import { createLogger } from "../lib/logger";
import { randomUUID } from "node:crypto";

const logger = createLogger("CONFIG-INTEGRITY");

/**
 * Ensure all configuration keys exist in the database with default values.
 */
export async function ensureConfiguration() {
    logger.info("Checking configuration integrity...");

    for (const [key, defaultValue] of Object.entries(CONFIG_DEFAULTS)) {
        try {
            const existing = await db.query.configuration.findFirst({
                where: eq(configuration.key, key),
            });

            if (!existing) {
                logger.info(`Missing configuration for key "${key}", creating with default value.`);
                await db.insert(configuration).values({
                    id: randomUUID(),
                    key,
                    value: defaultValue,
                });
            }
        } catch (error) {
            logger.error(`Failed to ensure configuration for key "${key}":`, error);
        }
    }

    logger.info("Configuration integrity check completed.");
}
