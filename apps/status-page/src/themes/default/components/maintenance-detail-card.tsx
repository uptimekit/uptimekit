import { IncidentCard } from "@/components/incident-card";
import type { Maintenance } from "../../types";

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
			<div className="mb-2 font-medium text-muted-foreground text-sm uppercase tracking-wider">
				Maintenance Details
			</div>
			<IncidentCard
				incident={maintenanceAsIncident}
				isExpanded={true}
				className="border-border bg-card shadow-sm"
			/>
			{maintenance.description && (
				<div className="mt-6 rounded-lg bg-card p-6">
					<h3 className="mb-2 font-semibold text-foreground">Description</h3>
					<p className="text-muted-foreground">{maintenance.description}</p>
				</div>
			)}
		</div>
	);
}
