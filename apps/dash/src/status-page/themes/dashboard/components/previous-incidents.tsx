import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import type React from "react";
import { IncidentCard } from "@/status-page/components/incident-card";
import { buildPath } from "@/status-page/lib/route-utils";
import type { Incident } from "../../types";

interface PreviousIncidentsProps {
    pastIncidents: Record<string, Incident[]>;
    slug?: string;
}

export function PreviousIncidents({
    pastIncidents,
    slug,
}: PreviousIncidentsProps): React.JSX.Element {
    const dates = Object.keys(pastIncidents);

    return (
        <section
            className="animate-slide-up space-y-6"
            style={{ animationDelay: "0.15s" }}
        >
            <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground text-lg tracking-tight">
                    Recent Incident History
                </h2>
                <Link
                    href={buildPath("/updates", slug) as any}
                    className="inline-flex items-center gap-1.5 font-medium text-muted-foreground text-xs transition-colors hover:text-foreground"
                >
                    <span>Full History</span>
                    <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3" />
                </Link>
            </div>

            <div className="space-y-6">
                {dates.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground text-sm shadow-2xs">
                        No recent incidents recorded.
                    </div>
                ) : (
                    Object.entries(pastIncidents).map(([date, incidents]) => (
                        <div key={date} className="space-y-3">
                            <div className="flex items-center gap-2 border-border/60 border-b pb-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                                {date}
                            </div>
                            <div className="space-y-2.5">
                                {incidents.map((incident) => (
                                    <IncidentCard
                                        key={incident.id}
                                        incident={incident}
                                        mode="link"
                                        href={incident.detailsLink}
                                        className="rounded-lg border-border bg-card shadow-2xs transition-colors hover:border-foreground/20 hover:bg-accent/40"
                                    />
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
}
