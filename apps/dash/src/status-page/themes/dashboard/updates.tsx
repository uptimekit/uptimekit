import { IncidentHistoryPeriodSelector } from "@/status-page/components/incident-history-period-selector";
import { buildPath } from "@/status-page/lib/route-utils";
import type { ThemeUpdatesProps } from "../types";
import { BackLink } from "./components/back-link";
import { CurrentIssuesBanner } from "./components/current-issues-banner";
import { Footer } from "./components/footer";
import { Header } from "./components/header";
import { UpdatesList } from "./components/updates-list";
import "./style.css";

export default function DashboardUpdates({ data }: ThemeUpdatesProps) {
    const { config, incidentsByDate, activeIssues, selectedPeriod } = data;
    const { design } = config;
    const updatesPath = buildPath("/updates", config.routeSlug);

    return (
        <div className="flex min-h-screen flex-col bg-background font-sans text-foreground antialiased selection:bg-foreground selection:text-background">
            <Header
                title={config.name}
                logoUrl={design.logoUrl}
                contactUrl={design.contactUrl}
                websiteUrl={design.websiteUrl}
                statusPageId={config.id}
                slug={config.routeSlug}
                allowSubscriptions={design.allowSubscriptions}
                layout={design.headerLayout}
            />

            <main className="w-full flex-1">
                <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
                    <BackLink href={buildPath("/", config.routeSlug)} />

                    <div className="mb-8">
                        <h1 className="font-bold text-2xl text-foreground tracking-tight sm:text-3xl">
                            Incident History & Updates
                        </h1>
                        <p className="mt-1 text-muted-foreground text-sm">
                            Historical incident reports, maintenance records,
                            and service events.
                        </p>
                    </div>

                    <IncidentHistoryPeriodSelector
                        basePath={updatesPath}
                        selectedPeriod={selectedPeriod}
                    />

                    <CurrentIssuesBanner activeIssues={activeIssues} />

                    <UpdatesList
                        incidentsByDate={incidentsByDate}
                        selectedPeriod={selectedPeriod}
                    />
                </div>
            </main>

            <Footer />
        </div>
    );
}
