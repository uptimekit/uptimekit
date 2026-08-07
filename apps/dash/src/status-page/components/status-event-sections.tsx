import Link from "next/link";
import { IncidentCard } from "@/status-page/components/incident-card";
import { buildPath } from "@/status-page/lib/route-utils";
import type { Incident } from "@/status-page/themes/types";

export function ActiveStatusEvents({ incidents }: { incidents: Incident[] }) {
    if (incidents.length === 0) return null;

    return (
        <section className="space-y-4" aria-labelledby="active-status-events">
            <h2 id="active-status-events" className="font-semibold text-lg">
                Current issues
            </h2>
            <div className="space-y-3">
                {incidents.map((incident) => (
                    <IncidentCard
                        key={incident.id}
                        incident={incident}
                        mode="expanded"
                        href={incident.detailsLink}
                        className="rounded-lg shadow-none"
                    />
                ))}
            </div>
        </section>
    );
}

export function StatusEventHistory({
    incidentsByDate,
    slug,
}: {
    incidentsByDate: Record<string, Incident[]>;
    slug?: string;
}) {
    return (
        <section className="space-y-4" aria-labelledby="status-event-history">
            <div className="flex items-center justify-between gap-4">
                <h2 id="status-event-history" className="font-semibold text-lg">
                    Incident history
                </h2>
                <Link
                    href={buildPath("/updates", slug) as any}
                    className="text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
                >
                    View all
                </Link>
            </div>
            {Object.keys(incidentsByDate).length === 0 ? (
                <p className="text-muted-foreground text-sm">
                    No previous incidents.
                </p>
            ) : (
                <div className="space-y-5">
                    {Object.entries(incidentsByDate).map(
                        ([date, incidents]) => (
                            <div key={date} className="space-y-2">
                                <h3 className="text-muted-foreground text-xs uppercase tracking-wide">
                                    {date}
                                </h3>
                                {incidents.map((incident) => (
                                    <IncidentCard
                                        key={incident.id}
                                        incident={incident}
                                        mode="link"
                                        href={incident.detailsLink}
                                        className="rounded-lg shadow-none"
                                    />
                                ))}
                            </div>
                        ),
                    )}
                </div>
            )}
        </section>
    );
}
