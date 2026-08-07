import { BackLink } from "@/components/back-link";
import { IncidentCard } from "@/components/incident-card";
import { ActiveStatusEvents } from "@/components/status-event-sections";
import { buildPath } from "@/lib/route-utils";
import type { ThemeIncidentDetailProps } from "../types";
import { Footer } from "./components/footer";
import { Header } from "./components/header";
import "./style.css";

export default function SparkIncidentDetail({
    data,
}: ThemeIncidentDetailProps) {
    const { config, incident, activeIssues } = data;
    const otherActiveIssues = activeIssues.filter(
        (issue) => issue.id !== incident.id,
    );

    return (
        <div className="spark-theme flex min-h-screen flex-col bg-background text-foreground">
            <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-7 pb-12 sm:pt-9">
                <Header config={config} />
                <BackLink href={buildPath("/", config.routeSlug)} />
                <section className="space-y-3">
                    <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                        Incident report
                    </p>
                    <h1 className="font-semibold text-3xl tracking-tight">
                        {incident.title}
                    </h1>
                    <IncidentCard incident={incident} mode="expanded" />
                </section>
                <ActiveStatusEvents incidents={otherActiveIssues} />
            </main>
            <Footer />
        </div>
    );
}
