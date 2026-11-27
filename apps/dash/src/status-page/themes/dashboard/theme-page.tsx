import { LinkedPagesSection } from "@/status-page/components/linked-pages-section";
import { ScheduledMaintenanceSection } from "@/status-page/components/scheduled-maintenance-section";
import type { ThemePageProps } from "../types";
import { ActiveIssuesSection } from "./components/active-issues-section";
import { Footer } from "./components/footer";
import { Header } from "./components/header";
import { MonitorGroups } from "./components/monitor-groups";
import { OverallStatus } from "./components/overall-status";
import { PreviousIncidents } from "./components/previous-incidents";
import "./style.css";

export default function DashboardTheme({ data }: ThemePageProps) {
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

    const allMonitors = monitorGroups.flatMap((g) => g.monitors);
    const monitorCount = allMonitors.length;
    const operationalCount = allMonitors.filter(
        (m) => m.currentStatus === "operational",
    ).length;

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
                    <section className="mb-10">
                        <OverallStatus
                            status={overallStatus}
                            monitorCount={monitorCount}
                            operationalCount={operationalCount}
                            incidentCount={activeIssues.length}
                            lastUpdated={lastUpdated}
                        />
                    </section>

                    <ActiveIssuesSection activeIssues={activeIssues} />

                    <MonitorGroups
                        monitorGroups={monitorGroups}
                        layout={design.headerLayout}
                        barStyle={design.barStyle}
                        toFixed={design.percentDigits}
                    />

                    <ScheduledMaintenanceSection
                        scheduledMaintenances={scheduledMaintenances}
                    />

                    <LinkedPagesSection linkedPages={data.linkedPages} />

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
