import { IncidentCard } from "@/status-page/components/incident-card";
import { maintenanceToIncident } from "@/status-page/lib/status-event";
import type { Maintenance } from "@/status-page/themes/types";

interface ScheduledMaintenanceSectionProps {
    scheduledMaintenances: Maintenance[];
}

export function ScheduledMaintenanceSection({
    scheduledMaintenances,
}: ScheduledMaintenanceSectionProps) {
    if (scheduledMaintenances.length === 0) {
        return null;
    }

    const mappedScheduledMaintenances = scheduledMaintenances.map(
        maintenanceToIncident,
    );

    return (
        <section className="mb-16 animate-slide-up">
            <h2 className="mb-6 flex items-center gap-3 font-bold text-2xl text-foreground">
                Scheduled Maintenance
            </h2>
            <div className="space-y-6">
                {mappedScheduledMaintenances.map((maintenance) => (
                    <IncidentCard
                        key={maintenance.id}
                        incident={maintenance}
                        mode="link"
                        href={maintenance.detailsLink}
                        className="border-none bg-card/50 shadow-none hover:bg-card/80"
                    />
                ))}
            </div>
        </section>
    );
}
