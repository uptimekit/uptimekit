import {
	getIncidentHistoryLabel,
	type IncidentHistoryPeriod,
} from "@/lib/incident-history";
import type { Incident } from "../../types";
import { IssueCard } from "./issue-card";

interface UpdatesListProps {
	incidentsByDate: Record<string, Incident[]>;
	selectedPeriod: IncidentHistoryPeriod;
}

export function UpdatesList({
	incidentsByDate,
	selectedPeriod,
}: UpdatesListProps) {
	const emptyMessage =
		selectedPeriod === "all"
			? "No history items to display."
			: `No history items in the last ${getIncidentHistoryLabel(selectedPeriod)}.`;

	if (Object.keys(incidentsByDate).length === 0) {
		return (
			<div className="rounded-2xl border border-border border-dashed px-5 py-10 text-center text-muted-foreground">
				{emptyMessage}
			</div>
		);
	}

	return (
		<div className="space-y-8">
			{Object.entries(incidentsByDate).map(([date, incidents]) => (
				<section key={date} className="space-y-4">
					<div className="flex items-center gap-4">
						<h2 className="shrink-0 font-medium text-[14px] text-muted-foreground">
							{date}
						</h2>
						<div className="signal-divider h-px flex-1" />
					</div>
					<div className="space-y-3">
						{incidents.map((incident) => (
							<IssueCard
								key={incident.id}
								incident={incident}
								detailsLink={incident.detailsLink}
							/>
						))}
					</div>
				</section>
			))}
		</div>
	);
}
