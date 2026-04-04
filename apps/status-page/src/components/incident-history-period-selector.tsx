import Link from "next/link";
import {
	getIncidentHistoryLabel,
	type IncidentHistoryPeriod,
	INCIDENT_HISTORY_PERIODS,
} from "@/lib/incident-history";

interface IncidentHistoryPeriodSelectorProps {
	basePath: string;
	selectedPeriod: IncidentHistoryPeriod;
}

export function IncidentHistoryPeriodSelector({
	basePath,
	selectedPeriod,
}: IncidentHistoryPeriodSelectorProps) {
	return (
		<div className="mb-8 flex flex-wrap gap-2">
			{INCIDENT_HISTORY_PERIODS.map((period) => {
				const isActive = period === selectedPeriod;
				const href = period === "all" ? basePath : `${basePath}?period=${period}`;

				return (
					<Link
						key={period}
						href={href as any}
						className={[
							"inline-flex min-w-[5.5rem] items-center justify-center rounded-full border px-4 py-2 text-sm transition-colors",
							isActive
								? "border-foreground bg-foreground text-background"
								: "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
						].join(" ")}
					>
						{getIncidentHistoryLabel(period)}
					</Link>
				);
			})}
		</div>
	);
}
