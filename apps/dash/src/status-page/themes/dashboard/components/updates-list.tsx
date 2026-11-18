import type React from "react";
import { IncidentCard } from "@/status-page/components/incident-card";
import {
    getIncidentHistoryLabel,
    type IncidentHistoryPeriod,
} from "@/status-page/lib/incident-history";
import type { Incident } from "../../types";

interface UpdatesListProps {
    incidentsByDate: Record<string, Incident[]>;
    selectedPeriod: IncidentHistoryPeriod;
}

export function UpdatesList({
    incidentsByDate,
    selectedPeriod,
}: UpdatesListProps): React.JSX.Element {
    const emptyMessage =
        selectedPeriod === "all"
            ? "No incident history to display."
            : `No incidents recorded in the last ${getIncidentHistoryLabel(selectedPeriod)}.`;

    return (
        <div className="space-y-10">
            {Object.keys(incidentsByDate).length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm shadow-2xs">
                    {emptyMessage}
                </div>
            ) : (
                Object.entries(incidentsByDate).map(([date, incidents]) => (
                    <div key={date} className="space-y-4">
                        <div className="border-border/60 border-b pb-2 font-semibold text-base text-foreground tracking-tight">
                            {date}
                        </div>
                        <div className="space-y-3">
                            {incidents.map((incident) => (
                                <IncidentCard
                                    key={incident.id}
                                    incident={incident}
                                    mode="link"
                                    href={incident.detailsLink}
                                    className="rounded-xl border-border bg-card shadow-xs transition-colors hover:border-foreground/20 hover:bg-accent/40"
                                />
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
