"use client";

import { useState } from "react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import {
	generateMockIncidents,
	IncidentCard,
} from "@/components/incident-card";
import { MonitorCard } from "@/components/monitor-card";
import { OverallStatus } from "@/components/overall-status";
import type { StatusType } from "@/components/status-indicator";

interface Monitor {
	id: string;
	name: string;
	status: StatusType;
	uptime: number;
	responseTime?: number;
	url?: string;
}

const monitors: Monitor[] = [
	{
		id: "1",
		name: "API Gateway",
		status: "operational",
		uptime: 99.98,
		responseTime: 45,
		url: "https://api.example.com",
	},
	{
		id: "2",
		name: "Web Application",
		status: "operational",
		uptime: 99.95,
		responseTime: 120,
		url: "https://app.example.com",
	},
	{
		id: "3",
		name: "Authentication Service",
		status: "degraded",
		uptime: 99.85,
		responseTime: 250,
		url: "https://auth.example.com",
	},
	{
		id: "4",
		name: "Database Cluster",
		status: "operational",
		uptime: 99.99,
		responseTime: 12,
	},
	{
		id: "5",
		name: "CDN",
		status: "operational",
		uptime: 99.99,
		responseTime: 25,
		url: "https://cdn.example.com",
	},
	{
		id: "6",
		name: "Email Service",
		status: "operational",
		uptime: 99.92,
		responseTime: 180,
	},
];

function calculateOverallStatus(monitorList: Monitor[]): StatusType {
	const hasOutage = monitorList.some((m) => m.status === "major_outage");
	if (hasOutage) return "major_outage";

	const hasPartialOutage = monitorList.some(
		(m) => m.status === "partial_outage",
	);
	if (hasPartialOutage) return "partial_outage";

	const hasDegraded = monitorList.some((m) => m.status === "degraded");
	if (hasDegraded) return "degraded";

	const hasMaintenance = monitorList.some((m) => m.status === "maintenance");
	if (hasMaintenance) return "maintenance";

	return "operational";
}

export default function StatusPage() {
	const [expandedIncident, setExpandedIncident] = useState<string | null>(null);
	const incidents = generateMockIncidents();
	const overallStatus = calculateOverallStatus(monitors);

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<Header title="Acme Corp Status" />

			<main className="flex-1">
				<div className="mx-auto max-w-4xl px-4 pb-12">
					{/* Overall Status */}
					<section className="mb-10">
						<OverallStatus status={overallStatus} />
					</section>

					{/* Monitors */}
					<section className="mb-10">
						<h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground text-lg">
							<span className="inline-block h-1 w-1 rounded-full bg-primary" />
							Services
						</h2>
						<div className="grid gap-4 sm:grid-cols-2">
							{monitors.map((monitor, index) => (
								<div
									key={monitor.id}
									className="animate-slide-up"
									style={{ animationDelay: `${index * 0.05}s` }}
								>
									<MonitorCard
										name={monitor.name}
										status={monitor.status}
										uptime={monitor.uptime}
										responseTime={monitor.responseTime}
										url={monitor.url}
									/>
								</div>
							))}
						</div>
					</section>

					{/* Active Incidents */}
					{incidents.length > 0 && (
						<section className="mb-10">
							<h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground text-lg">
								<span className="inline-block h-1 w-1 rounded-full bg-status-partial-outage" />
								Recent Incidents
							</h2>
							<div className="space-y-4">
								{incidents.map((incident) => (
									<IncidentCard
										key={incident.id}
										incident={incident}
										isExpanded={expandedIncident === incident.id}
										onToggle={() =>
											setExpandedIncident(
												expandedIncident === incident.id ? null : incident.id,
											)
										}
									/>
								))}
							</div>
						</section>
					)}

					{/* Uptime Summary */}
					<section>
						<div className="rounded-xl border border-border bg-card p-6">
							<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
								<div>
									<h2 className="font-semibold text-card-foreground">
										90-Day Uptime Summary
									</h2>
									<p className="mt-1 text-muted-foreground text-sm">
										Overall system availability across all services
									</p>
								</div>
								<div className="text-right">
									<div className="font-bold text-3xl text-primary">99.95%</div>
									<div className="text-muted-foreground text-xs">
										Average uptime
									</div>
								</div>
							</div>
						</div>
					</section>
				</div>
			</main>

			<Footer />
		</div>
	);
}
