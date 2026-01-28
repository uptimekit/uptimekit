import { Footer } from "./components/footer";
import { Header } from "./components/header";
import { buildPath } from "@/lib/route-utils";
import type { ThemeIncidentDetailProps } from "../types";
import { BackLink } from "./components/back-link";
import { CurrentIssuesBanner } from "./components/current-issues-banner";
import { IncidentDetailCard } from "./components/incident-detail-card";

export default function DefaultIncidentDetail({
	data,
}: ThemeIncidentDetailProps) {
	const { config, incident, activeIssues } = data;
	const { design } = config;

	return (
		<div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
			<Header
				title={config.name}
				logoUrl={design.logoUrl}
				contactUrl={design.contactUrl}
				slug={config.slug}
			/>

			<main className="w-full flex-1">
				<div className="mx-auto max-w-3xl px-4 py-10">
					<BackLink href={buildPath("/", config.slug)} />
					<CurrentIssuesBanner activeIssues={activeIssues} />
					<IncidentDetailCard incident={incident} />
				</div>
			</main>

			<Footer />
		</div>
	);
}
