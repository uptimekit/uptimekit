import type { StatusType } from "@/themes/types";

/**
 * Calculates the aggregate status from a list of statuses.
 * Priority order (highest to lowest):
 * 1. Major Outage
 * 2. Partial Outage
 * 3. Degraded Performance
 * 4. Maintenance (Active)
 * 5. Scheduled Maintenance
 * 6. Unknown
 * 7. Operational
 */
export function calculateAggregateStatus(
    statuses: StatusType[],
): StatusType {
    if (statuses.length === 0) return "unknown";

    let hasMajor = false;
    let hasPartial = false;
    let hasDegraded = false;
    let hasMaintenance = false;
    let hasScheduled = false;
    let hasUnknown = false;
    let allOutage = true;

    for (const s of statuses) {
        const isOutage = s === "major_outage" || s === "partial_outage";
        if (!isOutage) {
            allOutage = false;
        }

        switch (s) {
            case "major_outage":
                hasMajor = true;
                break;
            case "partial_outage":
                hasPartial = true;
                break;
            case "degraded":
                hasDegraded = true;
                break;
            case "maintenance":
                hasMaintenance = true;
                break;
            case "maintenance_scheduled":
                hasScheduled = true;
                break;
            case "unknown":
                hasUnknown = true;
                break;
        }
    }

    if (hasMajor) return "major_outage";
    if (hasPartial) return allOutage ? "major_outage" : "partial_outage";
    if (hasDegraded) return "degraded";
    if (hasMaintenance) return "maintenance";
    if (hasScheduled) return "maintenance_scheduled";
    if (hasUnknown) return "unknown";

    return "operational";
}
