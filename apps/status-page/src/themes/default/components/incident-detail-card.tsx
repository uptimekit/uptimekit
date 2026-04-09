import { IncidentCard } from "@/components/incident-card";
import type { Incident } from "../../types";

interface IncidentDetailCardProps {
	incident: Incident;
}

export function IncidentDetailCard({ incident }: IncidentDetailCardProps) {
	return (
		<div className="opacity-80">
			<div className="mb-2 font-medium text-muted-foreground text-sm tracking-wider">
				Previous Incident Report
			</div>
			<IncidentCard
				incident={incident}
				isExpanded={true}
				className="border-border bg-card shadow-sm"
			/>
		</div>
	);
}
