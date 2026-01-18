import { IncidentCard } from "@/components/incident-card";
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
				<span className="relative flex h-2.5 w-2.5">
					<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
					<span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
				</span>
				Current Issues
			</h2>
			<div className="space-y-6">
				{activeIssues.map((item) => (
					<IncidentCard
						key={item.id}
						incident={item as any}
						isExpanded={true}
						detailsLink={item.detailsLink}
						className="border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
					/>
				))}
			</div>
			<div className="my-8 h-px bg-border" />
		</section>
	);
}
