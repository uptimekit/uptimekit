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
        lastUpdated,
    } = data;
    const { design } = config;

    return (
        <div className="signal-theme flex min-h-screen flex-col bg-background font-sans text-foreground">
            <Header
                title={config.name}
                logoUrl={design.logoUrl}
                contactUrl={design.contactUrl}
                websiteUrl={design.websiteUrl}
                slug={config.routeSlug}
            />

            <main className="w-full flex-1">
                <div className="mx-auto flex w-full max-w-[822px] flex-col gap-10 px-4 pt-6 pb-16 sm:gap-12">
                    <OverallStatus
                        status={overallStatus}
                        lastUpdated={lastUpdated}
                    />
                    <CurrentIssuesBanner activeIssues={activeIssues} />
                    <MonitorGroups
                        monitorGroups={monitorGroups}
                        layout={design.headerLayout}
                        barStyle={design.barStyle}
                        toFixed={design.percentDigits}
                    />
                    <ScheduledMaintenanceSection
                        scheduledMaintenances={scheduledMaintenances}
                        slug={config.routeSlug}
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
