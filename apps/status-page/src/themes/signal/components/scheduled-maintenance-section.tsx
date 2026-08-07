import { maintenanceToIncident } from "@/lib/status-event";
import type { Maintenance } from "../../types";
import { IssueCard } from "./issue-card";

export function ScheduledMaintenanceSection({
    scheduledMaintenances,
}: {
    scheduledMaintenances: Maintenance[];
}) {
    if (scheduledMaintenances.length === 0) {
        return null;
    }

    const items = scheduledMaintenances.map(maintenanceToIncident);

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <h2 className="font-semibold text-[18px] tracking-tight">
                    Scheduled maintenance
                </h2>
                <div className="signal-divider h-px flex-1" />
            </div>

            <div className="space-y-3">
                {items.map((item) => (
                    <IssueCard
                        key={item.id}
                        incident={item}
                        mode="link"
                        href={item.detailsLink}
                    />
                ))}
            </div>
        </section>
    );
}
