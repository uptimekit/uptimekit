import type { Incident } from "../../types";
import { IssueCard } from "./issue-card";

interface DetailCardProps {
	incident: Incident;
	eyebrow: string;
	description?: string | null;
}

export function DetailCard({
	incident,
	eyebrow,
	description,
}: DetailCardProps) {
	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<div className="text-[11px] font-medium text-muted-foreground">
					{eyebrow}
				</div>
				<h1 className="font-semibold text-3xl tracking-tight text-foreground">
					{incident.title}
				</h1>
			</div>

			<IssueCard incident={incident} isExpanded={true} />

			{description ? (
				<div className="signal-panel rounded-2xl border border-border px-4 py-4 sm:px-5">
					<div className="mb-2 text-[11px] font-medium text-muted-foreground">
						Description
					</div>
					<p className="text-[14px] leading-6 text-foreground">{description}</p>
				</div>
			) : null}
		</div>
	);
}
