import { Footer } from "./components/footer";
import { Header } from "./components/header";
import { buildPath } from "@/lib/route-utils";
import type { ThemeUpdatesProps } from "../types";
import { BackLink } from "./components/back-link";
import { CurrentIssuesBanner } from "./components/current-issues-banner";
import { UpdatesList } from "./components/updates-list";

export default function DefaultUpdates({ data }: ThemeUpdatesProps) {
	const { config, incidentsByDate, activeIssues } = data;
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
					<BackLink href={buildPath("/", config.slug)} />

					<h1 className="mb-8 font-bold text-3xl text-foreground">
						Incident History
					</h1>

					<CurrentIssuesBanner activeIssues={activeIssues} />
					<UpdatesList incidentsByDate={incidentsByDate} />
				</div>
			</main>

			<Footer />
		</div>
	);
}
