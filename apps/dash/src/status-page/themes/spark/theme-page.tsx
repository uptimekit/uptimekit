import { ScheduledMaintenanceSection } from "@/status-page/components/scheduled-maintenance-section";
import {
    ActiveStatusEvents,
    StatusEventHistory,
} from "@/status-page/components/status-event-sections";
import { cn } from "@/status-page/lib/utils";
import { statusConfig } from "../status-config";
import type { Incident, StatusType, ThemePageProps } from "../types";
import { Calendar } from "./components/calendar";
import { Footer } from "./components/footer";
import { Header } from "./components/header";
import { MonitorGroups } from "./components/monitor-groups";
import "./style.css";

function StatusBanner({
    status,
    activeIssues,
}: {
    status: StatusType;
    activeIssues: Incident[];
}) {
    const messages = {
        operational: {
            title: "We're fully operational",
            description: "We're not aware of any issues affecting our systems.",
        },
        degraded: {
            title: "Some systems are degraded",
            description: "Some services are responding slower than normal.",
        },
        partial_outage: {
            title: "Some systems are unavailable",
            description: "A subset of services is currently impacted.",
        },
        major_outage: {
            title: "We're investigating an outage",
            description: "Multiple services are currently impacted.",
        },
        maintenance: {
            title: "Maintenance is in progress",
            description: "Planned work is currently affecting some services.",
        },
        maintenance_scheduled: {
            title: "Maintenance is scheduled",
            description: "Planned work is scheduled for one or more services.",
        },
        maintenance_completed: {
            title: "Maintenance is complete",
            description: "Planned work has been completed successfully.",
        },
        unknown: {
            title: "Current status is unknown",
            description: "We're unable to determine the current service state.",
        },
    };
    const message = messages[status];
    const config = statusConfig[status];

    return (
        <section
            className="overflow-hidden rounded-md border shadow-sm"
            style={{ borderColor: `var(--${config.theColor})` }}
        >
            <div
                className={cn(
                    "flex min-h-14 items-center gap-2 border-border border-b px-4 font-semibold",
                    config.theInsideColor,
                )}
            >
                <span
                    className={cn(
                        "inline-flex h-4 w-4 select-none items-center justify-center rounded-full text-[10px] text-background",
                        config.bgColor,
                    )}
                >
                    {status === "operational" ||
                    status === "maintenance_completed"
                        ? "✓"
                        : "!"}
                </span>
                {message.title}
            </div>
            <div className="px-4 py-4 text-sm">
                {activeIssues[0]?.title ?? message.description}
            </div>
        </section>
    );
}

export default function SparkTheme({ data }: ThemePageProps) {
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
        <div className="spark-theme flex min-h-screen flex-col bg-background font-sans text-foreground">
            <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-7 pb-12 sm:pt-9">
                <Header config={config} />
                <StatusBanner
                    status={overallStatus}
                    activeIssues={activeIssues}
                />
                <MonitorGroups
                    monitorGroups={monitorGroups}
                    toFixed={design.percentDigits}
                />
                <Calendar
                    lastUpdated={lastUpdated}
                    monitorGroups={monitorGroups}
                />
                <ActiveStatusEvents incidents={activeIssues} />
                <ScheduledMaintenanceSection
                    scheduledMaintenances={scheduledMaintenances}
                />
                <StatusEventHistory
                    incidentsByDate={pastIncidents}
                    slug={config.routeSlug}
                />
            </main>
            <Footer />
        </div>
    );
}
