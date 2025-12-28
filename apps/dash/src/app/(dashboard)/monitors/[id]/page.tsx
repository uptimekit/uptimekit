"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
	AlertTriangle,
	ArrowLeft,
	CheckCircle2,
	Clock,
	Globe,
	HelpCircle,
	XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AvailabilityTable } from "@/components/monitors/availability-table";
import { MonitorCards } from "@/components/monitors/monitor-cards";
import { ResponseTimeChart } from "@/components/monitors/response-time-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

export default function MonitorDetailsPage() {
	const params = useParams();
	const id = params.id as string;

	const { data: monitor, isLoading: loadingMonitor } = useQuery(
		orpc.monitors.get.queryOptions({ input: { id } }),
	);

	const { data: availability, isLoading: loadingAvailability } = useQuery(
		orpc.monitors.getAvailability.queryOptions({ input: { monitorId: id } }),
	);

	if (loadingMonitor) {
		return <MonitorSkeleton />;
	}

	if (!monitor) {
		return (
			<div className="flex flex-col items-center justify-center py-10">
				<h2 className="font-bold text-xl">Monitor not found</h2>
				<Button asChild className="mt-4">
					<Link href="/monitors">Go back to monitors</Link>
				</Button>
			</div>
		);
	}

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "up":
				return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
			case "down":
				return <XCircle className="h-5 w-5 text-red-500" />;
			case "degraded":
				return <AlertTriangle className="h-5 w-5 text-amber-500" />;
			case "maintenance":
				return <Clock className="h-5 w-5 text-blue-500" />;
			case "pending":
				return <HelpCircle className="h-5 w-5 text-zinc-500" />;
			default:
				return <HelpCircle className="h-5 w-5 text-muted-foreground" />;
		}
	};

	const getStatusText = (status: string) => {
		switch (status) {
			case "up":
				return "Operational";
			case "down":
				return "Downtime";
			case "degraded":
				return "Degraded";
			case "maintenance":
				return "Maintenance";
			case "pending":
				return "Pending";
			default:
				return "Unknown";
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "up":
				return "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20";
			case "down":
				return "bg-red-500/10 text-red-500 hover:bg-red-500/20";
			case "degraded":
				return "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20";
			case "maintenance":
				return "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20";
			default:
				return "bg-zinc-500/10 text-zinc-500 hover:bg-zinc-500/20";
		}
	};

	// Calculate current status duration
	// Calculate current status duration
	let currentStatusDuration = "-";
	if (monitor) {
		if (monitor.status === "up") {
			const neverDown = availability?.all?.incidentCount === 0;
			if (neverDown && monitor.createdAt) {
				currentStatusDuration = formatDistanceToNow(
					new Date(monitor.createdAt),
				);
			} else if (monitor.lastStatusChange) {
				currentStatusDuration = formatDistanceToNow(
					new Date(monitor.lastStatusChange),
				);
			} else if (monitor.createdAt) {
				// Fallback to createdAt if no changes
				currentStatusDuration = formatDistanceToNow(
					new Date(monitor.createdAt),
				);
			}
		} else if (monitor.lastStatusChange) {
			currentStatusDuration = formatDistanceToNow(
				new Date(monitor.lastStatusChange),
			);
		}
	}

	// Get display target based on monitor type
	const getMonitorTarget = () => {
		const config = monitor.config as Record<string, any>;
		switch (monitor.type) {
			case "tcp":
				return `${config.hostname}:${config.port}`;
			case "ping":
				return config.hostname;
			case "keyword":
			case "http-json":
			case "http":
			default:
				return config.url;
		}
	};

	return (
		<div className="flex flex-col gap-6 p-6">
			{/* Header */}
			<div className="flex items-center gap-4">
				<Button asChild variant="ghost" size="icon">
					<Link href="/monitors">
						<ArrowLeft className="h-4 w-4" />
					</Link>
				</Button>
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-3">
						<h1 className="font-bold text-2xl tracking-tight">
							{monitor.name}
						</h1>
						<Badge
							variant="secondary"
							className={cn(getStatusColor(monitor.status as string))}
						>
							{getStatusIcon(monitor.status as string)}
							<span className="ml-1.5 capitalize">
								{getStatusText(monitor.status as string)}
							</span>
						</Badge>
					</div>
					<div className="flex items-center gap-2 text-muted-foreground text-sm">
						<Globe className="h-3.5 w-3.5" />
						<span className="font-mono">
							{getMonitorTarget()}
						</span>
						<span>·</span>
						<Clock className="h-3.5 w-3.5" />
						<span>Checked every {monitor.interval}s</span>
					</div>
				</div>
				<div className="ml-auto flex items-center gap-2">
					<Button variant="outline" size="sm" asChild>
						<Link href={`/monitors/${id}/edit` as any}>Edit</Link>
					</Button>
					<Button variant="destructive" size="sm">
						Pause
					</Button>
				</div>
			</div>

			{/* Monitor Cards */}
			<MonitorCards
				status={monitor.status}
				lastCheck={monitor.lastCheck}
				currentStatusDuration={currentStatusDuration}
				incidentCount={availability?.today?.incidentCount || 0}
			/>

			{/* Response Time Chart */}
			<ResponseTimeChart
				monitorId={id}
				locations={(monitor.locations as string[]) || []}
				monitorType={monitor.type}
			/>

			{/* Availability Stats Table */}
			<div className="space-y-4">
				<AvailabilityTable
					data={availability}
					isLoading={loadingAvailability}
				/>
			</div>
		</div>
	);
}

function MonitorSkeleton() {
	return (
		<div className="flex flex-col gap-6 p-6">
			<div className="flex items-center gap-4">
				<Skeleton className="h-10 w-10" />
				<div className="flex flex-col gap-2">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-4 w-32" />
				</div>
				<div className="ml-auto">
					<Skeleton className="h-10 w-48" />
				</div>
			</div>
			<div className="grid gap-6 md:grid-cols-2">
				<Skeleton className="h-32" />
				<Skeleton className="h-32 md:col-span-2" />
			</div>
		</div>
	);
}
