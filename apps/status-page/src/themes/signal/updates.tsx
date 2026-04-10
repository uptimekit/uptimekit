import { IncidentHistoryPeriodSelector } from "@/components/incident-history-period-selector";
import { buildPath } from "@/lib/route-utils";
import type { ThemeUpdatesProps } from "../types";
import { BackLink } from "./components/back-link";
import { CurrentIssuesBanner } from "./components/current-issues-banner";
import { Footer } from "./components/footer";
import { Header } from "./components/header";
import { UpdatesList } from "./components/updates-list";
import "./style.css";

export default function SignalUpdates({ data }: ThemeUpdatesProps) {
	const { config, incidentsByDate, activeIssues, selectedPeriod } = data;
	const { design } = config;
	const updatesPath = buildPath("/updates", config.slug);

	return (
		<div className="signal-theme flex min-h-screen flex-col bg-background font-sans text-foreground">
			<Header
				title={config.name}
				logoUrl={design.logoUrl}
				contactUrl={design.contactUrl}
				websiteUrl={design.websiteUrl}
				slug={config.slug}
			/>

			<main className="w-full flex-1">
				<div className="mx-auto flex w-full max-w-[822px] flex-col gap-8 px-4 pt-6 pb-16">
					<BackLink href={buildPath("/", config.slug)} />
					<div className="space-y-2">
						<h1 className="font-semibold text-3xl tracking-tight">
							Incident history
						</h1>
						<p className="max-w-2xl text-muted-foreground text-sm sm:text-base">
							Recent incident reports and maintenance updates for this service.
						</p>
					</div>

					<IncidentHistoryPeriodSelector
						basePath={updatesPath}
						selectedPeriod={selectedPeriod}
					/>

					<CurrentIssuesBanner activeIssues={activeIssues} />
					<UpdatesList
						incidentsByDate={incidentsByDate}
						selectedPeriod={selectedPeriod}
					/>
				</div>
			</main>

			<Footer />
		</div>
	);
}
