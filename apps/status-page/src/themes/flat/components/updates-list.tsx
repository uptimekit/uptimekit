import {
	getIncidentHistoryLabel,
	type IncidentHistoryPeriod,
} from "@/lib/incident-history";
import { IncidentCard } from "./incident-card";
import type { Incident } from "../../types";

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

	return (
		<div className="space-y-10">
			{Object.keys(incidentsByDate).length === 0 ? (
				<p className="text-center text-muted-foreground">{emptyMessage}</p>
			) : (
				Object.entries(incidentsByDate).map(([date, incidents]) => (
					<div key={date}>
						<div className="mb-6 border-border border-b pb-2 font-semibold text-foreground text-xl">
							{date}
						</div>
						<div className="space-y-4">
							{incidents.map((incident) => (
								<IncidentCard
									key={incident.id}
									incident={incident}
									isExpanded={false}
									detailsLink={incident.detailsLink}
									className="border-border bg-card"
								/>
							))}
						</div>
					</div>
				))
			)}
		</div>
	);
}
