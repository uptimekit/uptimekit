import { BackLink } from "@/components/back-link";
import { IncidentHistoryPeriodSelector } from "@/components/incident-history-period-selector";
import {
    ActiveStatusEvents,
    StatusEventHistory,
} from "@/components/status-event-sections";
import { buildPath } from "@/lib/route-utils";
import type { ThemeUpdatesProps } from "../types";
import { Footer } from "./components/footer";
import { Header } from "./components/header";
import "./style.css";

export default function SparkUpdates({ data }: ThemeUpdatesProps) {
    const { config, incidentsByDate, activeIssues, selectedPeriod } = data;

    return (
        <div className="spark-theme flex min-h-screen flex-col bg-background text-foreground">
            <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-7 pb-12 sm:pt-9">
                <Header config={config} />
                <BackLink href={buildPath("/", config.routeSlug)} />
                <div className="space-y-2">
                    <h1 className="font-semibold text-3xl tracking-tight">
                        Incident history
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Incident reports and scheduled maintenance updates.
                    </p>
                </div>
                <IncidentHistoryPeriodSelector
                    basePath={buildPath("/updates", config.routeSlug)}
                    selectedPeriod={selectedPeriod}
                />
                <ActiveStatusEvents incidents={activeIssues} />
                <StatusEventHistory
                    incidentsByDate={incidentsByDate}
                    slug={config.routeSlug}
                />
            </main>
            <Footer />
        </div>
    );
}
