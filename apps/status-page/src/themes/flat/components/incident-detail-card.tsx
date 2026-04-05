import type { Incident } from "../../types";
import { IncidentCard } from "./incident-card";

interface IncidentDetailCardProps {
	incident: Incident;
}

export function IncidentDetailCard({ incident }: IncidentDetailCardProps) {
	return (
		<div className="opacity-80">
			<div className="mb-2 font-medium text-muted-foreground text-sm uppercase tracking-wider">
				Previous Incident Report
			</div>
			<IncidentCard
				incident={incident}
				isExpanded={true}
				className="border-border bg-card"
			/>
		</div>
	);
}
