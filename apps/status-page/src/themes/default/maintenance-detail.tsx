import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { buildPath } from "@/lib/route-utils";
import type { ThemeMaintenanceDetailProps } from "../types";
import { BackLink } from "./components/back-link";
import { CurrentIssuesBanner } from "./components/current-issues-banner";
import { MaintenanceDetailCard } from "./components/maintenance-detail-card";

export default function DefaultMaintenanceDetail({
	data,
}: ThemeMaintenanceDetailProps) {
	const { config, maintenance, activeIssues } = data;
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
					<CurrentIssuesBanner activeIssues={activeIssues} />
					<MaintenanceDetailCard maintenance={maintenance} />
				</div>
			</main>

			<Footer />
		</div>
	);
}
