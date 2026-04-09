import type { Maintenance } from "../../types";
import { IncidentCard } from "./incident-card";

interface MaintenanceDetailCardProps {
	maintenance: Maintenance;
}

export function MaintenanceDetailCard({
	maintenance,
}: MaintenanceDetailCardProps) {
	const maintenanceAsIncident = {
		id: maintenance.id,
		title: maintenance.title,
		status: maintenance.status,
		severity: "maintenance",
		startedAt: maintenance.startAt,
		endedAt: maintenance.endAt,
		monitors: maintenance.monitors,
		activities: [],
		detailsLink: maintenance.detailsLink,
	};

	return (
		<div className="opacity-80">
			<div className="mb-2 font-medium text-muted-foreground text-sm tracking-wider">
				Maintenance Details
			</div>
			<IncidentCard
				incident={maintenanceAsIncident}
				isExpanded={true}
				className="border-border bg-card"
			/>
			{maintenance.description && (
				<div className="mt-6 rounded-xl border border-border bg-muted/50 px-4 py-3">
					<h3 className="mb-2 font-semibold text-foreground">Description</h3>
					<p className="text-muted-foreground">{maintenance.description}</p>
				</div>
			)}
		</div>
	);
}
