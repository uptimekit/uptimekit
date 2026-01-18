import { IncidentCard } from "@/components/incident-card";
import type { Incident } from "../../types";

interface ActiveIssuesSectionProps {
	activeIssues: Incident[];
}

export function ActiveIssuesSection({
	activeIssues,
}: ActiveIssuesSectionProps) {
	if (activeIssues.length === 0) {
		return null;
	}

	return (
		<section className="mb-16 animate-slide-up">
			<h2 className="mb-6 flex items-center gap-3 font-bold text-2xl text-foreground">
				<span className="relative flex h-3 w-3">
					<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-major-outage opacity-75" />
					<span className="relative inline-flex h-3 w-3 rounded-full bg-status-major-outage" />
				</span>
				Current Issues
			</h2>
			<div className="space-y-6">
				{activeIssues.map((incident) => (
					<IncidentCard
						key={incident.id}
						incident={incident as any}
						isExpanded={true}
						detailsLink={incident.detailsLink}
						onToggle={undefined}
					/>
				))}
			</div>
		</section>
	);
}
