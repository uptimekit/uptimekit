import { IncidentCard } from "./incident-card";
import type { Incident } from "../../types";

interface CurrentIssuesBannerProps {
	activeIssues: Incident[];
}

export function CurrentIssuesBanner({
	activeIssues,
}: CurrentIssuesBannerProps) {
	if (activeIssues.length === 0) {
		return null;
	}

	return (
		<section className="mb-12 animate-slide-up">
			<h2 className="mb-6 flex items-center gap-3 font-bold text-foreground/80 text-lg">
				Current Issues
			</h2>
			<div className="space-y-6">
				{activeIssues.map((item) => (
					<IncidentCard
						key={item.id}
						incident={item as any}
						isExpanded={true}
						detailsLink={item.detailsLink}
					/>
				))}
			</div>
			<div className="my-8 h-px bg-border" />
		</section>
	);
}
