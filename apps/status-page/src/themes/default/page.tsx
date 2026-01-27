import { Footer } from "./components/footer";
import { Header } from "./components/header";
import { OverallStatus } from "./components/overall-status";
import { ScheduledMaintenanceSection } from "@/components/scheduled-maintenance-section";
import type { ThemePageProps } from "../types";
import { ActiveIssuesSection } from "./components/active-issues-section";
import { MonitorGroups } from "./components/monitor-groups";
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
			/>

			<main className="w-full flex-1">
				<div className="mx-auto max-w-5xl px-4 py-12">
					<section className="mb-16">
						<OverallStatus status={overallStatus} />
					</section>

					<MonitorGroups monitorGroups={monitorGroups} />
					<ActiveIssuesSection activeIssues={activeIssues} />

					<ScheduledMaintenanceSection
						scheduledMaintenances={scheduledMaintenances}
						slug={config.slug}
					/>

					<PreviousIncidents pastIncidents={pastIncidents} slug={config.slug} />
				</div>
			</main>

			<Footer />
		</div>
	);
}
