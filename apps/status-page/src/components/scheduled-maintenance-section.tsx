import { IncidentCard } from "@/components/incident-card";
import { buildPath } from "@/lib/route-utils";

interface ScheduledMaintenanceSectionProps {
	scheduledMaintenances: any[];
	slug?: string;
}

export function ScheduledMaintenanceSection({
	scheduledMaintenances,
	slug,
}: ScheduledMaintenanceSectionProps) {
	if (scheduledMaintenances.length === 0) {
		return null;
	}

	const mappedScheduledMaintenances = scheduledMaintenances.map((m: any) => ({
		id: m.id,
		title: m.title,
		status: m.status,
		severity: "maintenance",
		createdAt: m.startAt,
		resolvedAt: null,
		monitors: m.monitors,
		activities: [],
		detailsLink: slug
			? buildPath(`/maintenance/${m.id}`, slug)
			: `/maintenance/${m.id}`,
	}));

	return (
		<section className="mb-16 animate-slide-up">
			<h2 className="mb-6 flex items-center gap-3 font-bold text-2xl text-foreground">
				Scheduled Maintenance
			</h2>
			<div className="space-y-6">
				{mappedScheduledMaintenances.map((maintenance) => (
					<IncidentCard
						key={maintenance.id}
						incident={maintenance as any}
						isExpanded={false}
						detailsLink={(maintenance as any).detailsLink}
						className="border-none bg-card/50 shadow-none hover:bg-card/80"
					/>
				))}
			</div>
		</section>
	);
}
