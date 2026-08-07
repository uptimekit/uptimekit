import type { ThemePageProps } from "../types";
import { CurrentIssuesBanner } from "./components/current-issues-banner";
import { Footer } from "./components/footer";
import { Header } from "./components/header";
import { MonitorGroups } from "./components/monitor-groups";
import { OverallStatus } from "./components/overall-status";
import { PreviousIncidents } from "./components/previous-incidents";
import { ScheduledMaintenanceSection } from "./components/scheduled-maintenance-section";
import "./style.css";

export default function SignalTheme({ data }: ThemePageProps) {
    const {
        config,
        overallStatus,
        monitorGroups,
        activeIssues,
        scheduledMaintenances,
        pastIncidents,
    } = data;
    const { design } = config;

    return (
        <div className="signal-theme flex min-h-screen flex-col bg-background font-sans text-foreground">
            <Header
                title={config.name}
                logoUrl={design.logoUrl}
                contactUrl={design.contactUrl}
                websiteUrl={design.websiteUrl}
                statusPageId={config.id}
                slug={config.routeSlug}
                allowSubscriptions={design.allowSubscriptions}
            />

            <main className="w-full flex-1">
                <div className="mx-auto flex w-full max-w-[822px] flex-col gap-12 px-4 pt-12 pb-[60px]">
                    <OverallStatus status={overallStatus} />
                    <CurrentIssuesBanner activeIssues={activeIssues} />
                    <div className="signal-divider h-0.5 w-full rounded-full" />
                    <MonitorGroups
                        monitorGroups={monitorGroups}
                        toFixed={design.percentDigits}
                    />
                    <ScheduledMaintenanceSection
                        scheduledMaintenances={scheduledMaintenances}
                    />
                    <PreviousIncidents
                        pastIncidents={pastIncidents}
                        slug={config.routeSlug}
                    />
                </div>
            </main>

            <Footer />
        </div>
    );
}
