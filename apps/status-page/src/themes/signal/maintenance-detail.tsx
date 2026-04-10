import { buildPath } from "@/lib/route-utils";
import type { ThemeMaintenanceDetailProps } from "../types";
import { BackLink } from "./components/back-link";
import { CurrentIssuesBanner } from "./components/current-issues-banner";
import { DetailCard } from "./components/detail-card";
import { Footer } from "./components/footer";
import { Header } from "./components/header";
import "./style.css";

export default function SignalMaintenanceDetail({
	data,
}: ThemeMaintenanceDetailProps) {
	const { config, maintenance, activeIssues } = data;
	const { design } = config;

	const maintenanceAsIncident = {
		id: maintenance.id,
		title: maintenance.title,
		status: maintenance.status,
		severity: "maintenance",
		startedAt: maintenance.startAt,
		endedAt: maintenance.endAt,
		monitors: maintenance.monitors,
		activities: [],
		detailsLink: maintenance.detailsLink,
	};

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
					<CurrentIssuesBanner activeIssues={activeIssues} />
					<DetailCard
						incident={maintenanceAsIncident}
						eyebrow="Scheduled maintenance"
						description={maintenance.description}
					/>
				</div>
			</main>

			<Footer />
		</div>
	);
}
