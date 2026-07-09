import { cn } from "@/lib/utils";
import type { Incident, StatusType, ThemePageProps } from "../types";
import { Calendar } from "./components/calendar";
import { Header } from "./components/header";
import { MonitorGroups } from "./components/monitor-groups";
import "./style.css";
import Image from "next/image";
import { Logo } from "./components/uk-logo";

function StatusBanner({
    status,
    activeIssues,
}: {
    status: StatusType;
    activeIssues: Incident[];
}) {
    const isOperational = status === "operational";

    return (
        <section
            className={cn(
                "overflow-hidden rounded-md border bg-card",
                isOperational
                    ? "border-status-operational"
                    : "border-status-major-outage",
            )}
        >
            <div
                className={cn(
                    "flex min-h-14 items-center gap-2 px-4 font-semibold",
                    isOperational
                        ? "bg-status-operational/25 text-foreground"
                        : "bg-status-major-outage/20 text-foreground",
                )}
            >
                <span
                    className={cn(
                        "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-background",
                        isOperational
                            ? "bg-status-operational"
                            : "bg-status-major-outage",
                    )}
                >
                    {isOperational ? "✓" : "!"}
                </span>
                {isOperational
                    ? "We're fully operational"
                    : "We're investigating an issue"}
            </div>
            <div className="px-4 py-4 text-sm">
                {isOperational
                    ? "We're not aware of any issues affecting our systems."
                    : (activeIssues[0]?.title ??
                      "Some systems are currently affected.")}
            </div>
        </section>
    );
}

function Footer() {
    return (
        <footer className="mx-auto w-full max-w-2xl pb-8 text-center text-[#787882] text-sm">
            <div className="flex items-center justify-center gap-2">
                <div>Powered by </div>
                <a
                    className="flex items-center gap-1"
                    href="https://github.com/uptimekit/uptimekit"
                    target="_blank"
                    rel="noopener"
                >
                    <Logo className="size-6" />
                    <p className="font-semibold text-[#787882] text-md">
                        UptimeKit
                    </p>
                </a>
            </div>
            {/* <div className="mt-4 text-xs">
                Privacy policy · Terms of service
            </div> */}
        </footer>
    );
}

export default function SparkTheme({ data }: ThemePageProps) {
    const { config, overallStatus, monitorGroups, activeIssues, lastUpdated } =
        data;
    const { design } = config;

    return (
        <div className="spark-theme flex min-h-screen flex-col bg-background font-sans text-foreground">
            <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 pt-9 pb-12">
                <Header data={data} />
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
            </main>
            <Footer />
        </div>
    );
}
