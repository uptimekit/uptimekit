import { formatDistanceToNow } from "date-fns";
import { Activity, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MonitorCardsProps {
	status: string;
	lastCheck: string | Date | null;

	// "Currently up for" implies we need the timestamp of the last *change* to status.
	// The previous implementation of `getTimeline` or `get` might give us `lastChange`.
	// Let's assume we pass in the raw duration or calculate it.
	// Based on plan: "Displays the 3 top cards."
	// Let's take specific props.
	currentStatusDuration?: string; // Pre-calculated string or raw ms
	incidentCount: number;
}

export function MonitorCards({
	status,
	lastCheck,
	currentStatusDuration,
	incidentCount,
}: MonitorCardsProps) {
	const isUp = status === "up";
	const isMaintenance = status === "maintenance";

	return (
		<div className="mb-8 grid gap-4 md:grid-cols-3">
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="font-medium text-sm">
						Currently{" "}
						{isUp ? "up" : isMaintenance ? "under maintenance" : "down"} for
					</CardTitle>
					<Activity
						className={`h-4 w-4 ${
							isUp
								? "text-green-500"
								: isMaintenance
									? "text-blue-500"
									: "text-red-500"
						}`}
					/>
				</CardHeader>
				<CardContent>
					<div className="font-bold text-2xl">
						{currentStatusDuration || "-"}
					</div>
					<p className="text-muted-foreground text-xs">
						{isUp
							? "Monitor is operational"
							: isMaintenance
								? "Maintenance in progress"
								: "Monitor is facing issues"}
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="font-medium text-sm">Last checked at</CardTitle>
					<Clock className="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="font-bold text-2xl">
						{lastCheck ? new Date(lastCheck).toLocaleTimeString() : "-"}
					</div>
					<p className="text-muted-foreground text-xs">
						{lastCheck
							? formatDistanceToNow(new Date(lastCheck), { addSuffix: true })
							: "Never checked"}
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="font-medium text-sm">Incidents (24h)</CardTitle>
					<AlertTriangle className="h-4 w-4 text-yellow-500" />
				</CardHeader>
				<CardContent>
					<div className="font-bold text-2xl">{incidentCount}</div>
					<p className="text-muted-foreground text-xs">
						Recorded in the last 24 hours
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
