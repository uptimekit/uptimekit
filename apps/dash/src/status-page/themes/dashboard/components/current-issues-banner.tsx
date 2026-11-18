import type React from "react";
import { IncidentCard } from "@/status-page/components/incident-card";
import type { Incident } from "../../types";

interface CurrentIssuesBannerProps {
    activeIssues: Incident[];
}

export function CurrentIssuesBanner({
    activeIssues,
}: CurrentIssuesBannerProps): React.JSX.Element | null {
    if (activeIssues.length === 0) {
        return null;
    }

    return (
        <section className="mb-10 animate-slide-up">
            <div className="mb-4 flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                </span>
                <h2 className="font-semibold text-base text-foreground tracking-tight">
                    Ongoing Incidents
                </h2>
            </div>
            <div className="space-y-4">
                {activeIssues.map((item) => (
                    <IncidentCard
                        key={item.id}
                        incident={item}
                        mode="expanded"
                        href={item.detailsLink}
                        className="rounded-xl border-border bg-card shadow-xs"
                    />
                ))}
            </div>
            <div className="my-8 h-px bg-border/60" />
        </section>
    );
}
