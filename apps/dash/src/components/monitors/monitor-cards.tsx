import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Clock, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

	return (
		<div className="grid gap-4 md:grid-cols-3 mb-8">
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">
						Currently {isUp ? "up" : "down"} for
					</CardTitle>
					<Activity
						className={`h-4 w-4 ${isUp ? "text-green-500" : "text-red-500"}`}
					/>
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">
						{currentStatusDuration || "-"}
					</div>
					<p className="text-xs text-muted-foreground">
						{isUp ? "Monitor is operational" : "Monitor is facing issues"}
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">Last checked at</CardTitle>
					<Clock className="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">
						{lastCheck ? new Date(lastCheck).toLocaleTimeString() : "-"}
					</div>
					<p className="text-xs text-muted-foreground">
						{lastCheck
							? formatDistanceToNow(new Date(lastCheck), { addSuffix: true })
							: "Never checked"}
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">Incidents (24h)</CardTitle>
					<AlertTriangle className="h-4 w-4 text-yellow-500" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">{incidentCount}</div>
					<p className="text-xs text-muted-foreground">
						Recorded in the last 24 hours
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
