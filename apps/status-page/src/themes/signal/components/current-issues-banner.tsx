import type { Incident } from "../../types";
import { IssueCard } from "./issue-card";

export function CurrentIssuesBanner({
	activeIssues,
}: {
	activeIssues: Incident[];
}) {
	if (activeIssues.length === 0) {
		return null;
	}

	return (
		<section className="space-y-4">
			<div className="flex items-center justify-between gap-4">
				<h2 className="font-semibold text-[18px] tracking-tight">
					Current issues
				</h2>
				<div className="signal-divider h-px flex-1" />
			</div>
			<div className="space-y-3">
				{activeIssues.map((issue) => (
					<IssueCard
						key={issue.id}
						incident={issue}
						isExpanded={true}
						detailsLink={issue.detailsLink}
					/>
				))}
			</div>
		</section>
	);
}
