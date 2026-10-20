export type MaintenanceStatus = "scheduled" | "in_progress" | "completed";

export function getMaintenanceStatus(
    item: {
        startedAt: Date;
        plannedEndAt?: Date | null;
        endedAt: Date | null;
    },
    now = new Date(),
): MaintenanceStatus {
    if (item.endedAt) return "completed";
    if (item.plannedEndAt && item.plannedEndAt <= now) return "completed";
    if (item.startedAt > now) return "scheduled";
    return "in_progress";
}
