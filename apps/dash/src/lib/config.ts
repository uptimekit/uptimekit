import { CONFIG_DEFAULTS, db } from "@uptimekit/db";

export async function getConfig() {
    const userSettings = await db.query.configuration.findMany();

    // Merge with defaults - database values take precedence
    const dbMap = new Map(userSettings.map((i) => [i.key, i]));
    const mergedItems = Object.entries(CONFIG_DEFAULTS).map(
        ([key, defaultValue]) => {
            const dbItem = dbMap.get(key);
            if (dbItem) {
                return dbItem;
            }
            return {
                id: `default-${key}`,
                key,
                value: defaultValue,
                createdAt: null,
                updatedAt: null,
            };
        },
    );

    // Add any extra items from DB that aren't in defaults
    for (const item of userSettings) {
        if (!CONFIG_DEFAULTS[item.key]) {
            mergedItems.push(item);
        }
    }

    return { items: mergedItems };
}
