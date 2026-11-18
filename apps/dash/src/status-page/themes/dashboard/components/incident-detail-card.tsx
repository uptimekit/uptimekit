import type React from "react";
import { IncidentCard } from "@/status-page/components/incident-card";
import type { Incident } from "../../types";

interface IncidentDetailCardProps {
    incident: Incident;
}

export function IncidentDetailCard({
    incident,
}: IncidentDetailCardProps): React.JSX.Element {
    const isResolved = incident.endedAt !== null;

    return (
        <div className={isResolved ? "opacity-90" : undefined}>
            <div className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                {isResolved
                    ? "Resolved Incident Report"
                    : "Active Incident Investigation"}
            </div>
            <IncidentCard
                incident={incident}
                mode="expanded"
                className="rounded-xl border-border bg-card shadow-xs"
            />
        </div>
    );
}
