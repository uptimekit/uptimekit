import type React from "react";
import { IncidentCard } from "@/status-page/components/incident-card";
import type { Incident } from "../../types";

interface ActiveIssuesSectionProps {
    activeIssues: Incident[];
}

export function ActiveIssuesSection({
    activeIssues,
}: ActiveIssuesSectionProps): React.JSX.Element | null {
    if (activeIssues.length === 0) {
        return null;
    }

    return (
        <section className="mb-12 animate-slide-up">
            <div className="mb-4 flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                </span>
                <h2 className="font-semibold text-foreground text-lg tracking-tight">
                    Active Incidents
                </h2>
                <span className="rounded-full border border-border bg-secondary/80 px-2 py-0.5 font-medium text-[11px] text-muted-foreground">
                    {activeIssues.length}
                </span>
            </div>
            <div className="space-y-4">
                {activeIssues.map((incident) => (
                    <IncidentCard
                        key={incident.id}
                        incident={incident}
                        mode="expanded"
                        href={incident.detailsLink}
                        className="rounded-xl border-border bg-card shadow-xs"
                    />
                ))}
            </div>
        </section>
    );
}
