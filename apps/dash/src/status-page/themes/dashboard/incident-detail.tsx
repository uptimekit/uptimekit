import { buildPath } from "@/status-page/lib/route-utils";
import type { ThemeIncidentDetailProps } from "../types";
import { BackLink } from "./components/back-link";
import { CurrentIssuesBanner } from "./components/current-issues-banner";
import { Footer } from "./components/footer";
import { Header } from "./components/header";
import { IncidentDetailCard } from "./components/incident-detail-card";
import "./style.css";

export default function DashboardIncidentDetail({
    data,
}: ThemeIncidentDetailProps) {
    const { config, incident, activeIssues } = data;
    const otherActiveIssues = activeIssues.filter(
        (issue) => issue.id !== incident.id,
    );
    const { design } = config;

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
                <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
                    <BackLink href={buildPath("/", config.routeSlug)} />
                    <CurrentIssuesBanner activeIssues={otherActiveIssues} />
                    <IncidentDetailCard incident={incident} />
                </div>
            </main>

            <Footer />
        </div>
    );
}
