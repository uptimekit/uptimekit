import { ScheduledMaintenanceSection } from "@/status-page/components/scheduled-maintenance-section";
import type { ThemePageProps } from "../types";
import { ActiveIssuesSection } from "./components/active-issues-section";
import { Footer } from "./components/footer";
import { Header } from "./components/header";
import { MonitorGroups } from "./components/monitor-groups";
import { OverallStatus } from "./components/overall-status";
import { PreviousIncidents } from "./components/previous-incidents";
import "./style.css";

export default function DefaultTheme({ data }: ThemePageProps) {
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
        <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
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
                <div className="mx-auto max-w-5xl px-4 py-12">
                    <section className="mb-16">
                        <OverallStatus
                            status={overallStatus}
                            monitorGroups={monitorGroups}
                            activeIssues={activeIssues}
                        />
                    </section>

                    <MonitorGroups
                        monitorGroups={monitorGroups}
                        layout={design.headerLayout}
                        barStyle={design.barStyle}
                        toFixed={design.percentDigits}
                    />
                    <ActiveIssuesSection activeIssues={activeIssues} />

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
