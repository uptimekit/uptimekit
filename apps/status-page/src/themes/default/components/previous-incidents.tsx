import Link from "next/link";
import { IncidentCard } from "@/components/incident-card";
import { buildPath } from "@/lib/route-utils";
import type { Incident } from "../../types";

interface PreviousIncidentsProps {
	pastIncidents: Record<string, Incident[]>;
	slug: string;
}

export function PreviousIncidents({
	pastIncidents,
	slug,
}: PreviousIncidentsProps) {
	return (
		<section className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
			<h2 className="mb-6 font-bold text-2xl text-foreground">
				Previous incidents
			</h2>

			<div className="space-y-8">
				{Object.keys(pastIncidents).length === 0 ? (
					<p className="text-muted-foreground">No previous incidents.</p>
				) : (
					Object.entries(pastIncidents).map(([date, incidents]) => (
						<div key={date}>
							<div className="mb-4 border-border border-b pb-2 font-medium text-muted-foreground text-sm">
								{date}
							</div>
							<div className="space-y-4">
								{incidents.map((incident) => (
									<IncidentCard
										key={incident.id}
										incident={incident}
										isExpanded={false}
										detailsLink={incident.detailsLink}
										className="border-none bg-card/50 shadow-none hover:bg-card/80"
									/>
								))}
							</div>
						</div>
					))
				)}
			</div>

			<Link href={buildPath("/updates", slug) as any}>
				<div className="mt-8 cursor-pointer rounded-lg bg-card/50 p-4 text-center transition-colors hover:bg-card/80">
					<span className="flex items-center justify-center gap-2 font-medium text-muted-foreground text-sm">
						Previous updates
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="lucide lucide-arrow-down-circle"
						>
							<title>update</title>
							<circle cx="12" cy="12" r="10" />
							<path d="M8 12l4 4 4-4" />
							<path d="M12 8v8" />
						</svg>
					</span>
				</div>
			</Link>
		</section>
	);
}
