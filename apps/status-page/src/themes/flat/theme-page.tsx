import { ScheduledMaintenanceSection } from "@/components/scheduled-maintenance-section";
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
        lastUpdated,
    } = data;
    const { design } = config;

    return (
        <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
            <Header
                title={config.name}
                logoUrl={design.logoUrl}
                contactUrl={design.contactUrl}
                statusPageId={config.id}
                slug={config.routeSlug}
                allowSubscriptions={design.allowSubscriptions}
            />

            <main className="w-full flex-1">
                <div className="mx-auto max-w-4xl px-4 py-10">
                    <section className="mb-10">
                        <OverallStatus
                            status={overallStatus}
                            lastUpdated={lastUpdated}
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
