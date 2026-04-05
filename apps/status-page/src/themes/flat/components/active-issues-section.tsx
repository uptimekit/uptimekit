import type { Incident } from "../../types";
import { IncidentCard } from "./incident-card";

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
		<section className="mb-12 animate-slide-up">
			<h2 className="mb-5 flex items-center gap-3 font-bold text-2xl text-foreground">
				Current Issues
			</h2>
			<div className="space-y-4">
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
