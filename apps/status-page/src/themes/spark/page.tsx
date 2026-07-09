import type { ThemePageProps } from "../types";
import { MonitorGroups } from "./components/monitor-groups";
import "./style.css";

export default function SparkTheme({ data }: ThemePageProps) {
    const { config, monitorGroups } = data;
    const { design } = config;

    return (
        <div className="spark-theme flex min-h-screen flex-col bg-background font-sans text-foreground">
            <main className="mx-auto w-full max-w-[670px] flex-1 px-4 py-5 sm:py-8">
                <MonitorGroups
                    monitorGroups={monitorGroups}
                    toFixed={design.percentDigits}
                />
            </main>
        </div>
    );
}
