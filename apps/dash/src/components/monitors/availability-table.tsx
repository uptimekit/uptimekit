import { intervalToDuration } from "date-fns";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

interface Stats {
	uptimePercent: number;
	downtimeMs: number;
	incidentCount: number;
	maxIncidentMs: number;
	avgIncidentMs: number;
}

interface AvailabilityTableProps {
	data?: {
		today: Stats;
		week: Stats;
		month: Stats;
		year: Stats;
		all: Stats;
	};
	isLoading?: boolean;
}

function formatMs(ms: number) {
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;

	// Use date-fns for nicer formatting for larger durations
	const duration = intervalToDuration({ start: 0, end: ms });

	// Filter out zero values for compactness (e.g. "1 hour", not "0 years 0 months ... 1 hour")
	// Simple manual approach for "1h 4m" style
	const parts = [];
	if (duration.years) parts.push(`${duration.years}y`);
	if (duration.months) parts.push(`${duration.months}mo`);
	if (duration.days) parts.push(`${duration.days}d`);
	if (duration.hours) parts.push(`${duration.hours}h`);
	if (duration.minutes) parts.push(`${duration.minutes}m`);
	if (duration.seconds && parts.length === 0)
		parts.push(`${duration.seconds}s`); // only show seconds if nothing else

	return parts.join(" ") || "0s";
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AvailabilityTable({ data, isLoading }: AvailabilityTableProps) {
	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="font-normal text-base">
						Availability & Incidents
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="py-8 text-center text-muted-foreground text-sm">
						Loading statistics...
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!data) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="font-normal text-base">
						Availability & Incidents
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="py-8 text-center text-muted-foreground text-sm">
						No statistics available
					</div>
				</CardContent>
			</Card>
		);
	}

	const rows = [
		{ label: "Today", ...data.today },
		{ label: "Last 7 days", ...data.week },
		{ label: "Last 30 days", ...data.month },
		{ label: "Last 365 days", ...data.year },
		{ label: "All time", ...data.all },
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle className="font-normal text-base">
					Availability & Incidents
				</CardTitle>
			</CardHeader>
			<CardContent className="p-0">
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead className="w-[200px] pl-6">Date</TableHead>
							<TableHead>Uptime</TableHead>
							<TableHead>Downtime</TableHead>
							<TableHead>Incidents</TableHead>
							<TableHead>Longest incident</TableHead>
							<TableHead>Avg. incident</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => (
							<TableRow key={row.label} className="hover:bg-muted/50">
								<TableCell className="pl-6 font-medium">{row.label}</TableCell>
								<TableCell>{row.uptimePercent.toFixed(2)}%</TableCell>
								<TableCell>{formatMs(row.downtimeMs)}</TableCell>
								<TableCell>{row.incidentCount}</TableCell>
								<TableCell>{formatMs(row.maxIncidentMs)}</TableCell>
								<TableCell>{formatMs(row.avgIncidentMs)}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
