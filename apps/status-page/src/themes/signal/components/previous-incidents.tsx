import Link from "next/link";
import { buildPath } from "@/lib/route-utils";
import type { Incident } from "../../types";
import { IssueCard } from "./issue-card";

interface PreviousIncidentsProps {
	pastIncidents: Record<string, Incident[]>;
	slug: string;
}

export function PreviousIncidents({
	pastIncidents,
	slug,
}: PreviousIncidentsProps) {
	return (
		<section className="space-y-4">
			<div className="flex items-center justify-between gap-4">
				<h2 className="font-semibold text-[18px] tracking-tight">
					Previous incidents
				</h2>
				<div className="signal-divider h-px flex-1" />
			</div>

			{Object.keys(pastIncidents).length === 0 ? (
				<div className="rounded-2xl border border-dashed border-border px-5 py-8 text-muted-foreground">
					No previous incidents.
				</div>
			) : (
				<div className="space-y-6">
					{Object.entries(pastIncidents).map(([date, incidents]) => (
						<div key={date} className="space-y-3">
							<div className="text-[13px] text-muted-foreground">{date}</div>
							<div className="space-y-3">
								{incidents.map((incident) => (
									<IssueCard
										key={incident.id}
										incident={incident}
										detailsLink={incident.detailsLink}
									/>
								))}
							</div>
						</div>
					))}
				</div>
			)}

			<Link
				href={buildPath("/updates", slug) as any}
				className="signal-button inline-flex h-9 items-center justify-center rounded-lg px-4 font-medium text-[13px] text-foreground transition-transform duration-150 hover:-translate-y-px"
			>
				View full history
			</Link>
		</section>
	);
}
