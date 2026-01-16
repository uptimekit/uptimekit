import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { IncidentCard } from "@/components/incident-card";
import {
	getActiveMaintenances,
	getActiveStatusPageReports,
	getMaintenanceHistory,
	getStatusPageBySlug,
	getStatusPageReports,
} from "@/lib/db-queries";
import { buildPath } from "@/lib/route-utils";

export default async function SlugUpdatesPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;

	const pageConfig = await getStatusPageBySlug(slug);

	if (!pageConfig) {
		notFound();
	}

	const limit = 50;
	const [reports, maintenances, activeReports, activeMaintenances] =
		await Promise.all([
			getStatusPageReports(pageConfig.id, limit),
			getMaintenanceHistory(pageConfig.id, limit),
			getActiveStatusPageReports(pageConfig.id),
			getActiveMaintenances(pageConfig.id),
		]);

	const allUpdates = [
		...reports.map((r: any) => ({
			id: r.id,
			title: r.title,
			status: r.status,
			severity: r.severity,
			createdAt: r.createdAt,
			resolvedAt: r.resolvedAt,
			monitors: r.affectedMonitors.map((am: any) => ({ monitor: am.monitor })),
			activities: r.updates.map((u: any) => ({
				id: u.id,
				message: u.message,
				createdAt: u.createdAt,
				type: "update",
			})),
			detailsLink: buildPath(`/incidents/${r.id}`, slug),
		})),
		...maintenances.map((m: any) => ({
			id: m.id,
			title: m.title,
			status: m.status,
			severity: "maintenance",
			createdAt: m.createdAt,
			resolvedAt: m.endAt,
			monitors: m.monitors,
			activities: [],
			detailsLink: buildPath(`/maintenance/${m.id}`, slug),
		})),
	].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	const incidentsByDate = allUpdates.reduce(
		(acc: any, incident) => {
			const date = new Date(incident.createdAt).toLocaleDateString("en-US", {
				month: "long",
				day: "numeric",
				year: "numeric",
			});
			if (!acc[date]) acc[date] = [];
			acc[date].push(incident);
			return acc;
		},
		{} as Record<string, typeof allUpdates>,
	);

	const combinedActive = [
		...activeReports.map((r: any) => ({
			id: r.id,
			title: r.title,
			status: r.status,
			severity: r.severity,
			createdAt: r.createdAt,
			resolvedAt: r.resolvedAt,
			monitors: r.affectedMonitors.map((am: any) => ({ monitor: am.monitor })),
			activities: r.updates.map((u: any) => ({
				id: u.id,
				message: u.message,
				createdAt: u.createdAt,
				type: "update",
			})),
			detailsLink: buildPath(`/incidents/${r.id}`, slug),
		})),
		...activeMaintenances.map((m: any) => ({
			id: m.id,
			title: m.title,
			status: m.status,
			severity: "maintenance",
			createdAt: m.createdAt,
			resolvedAt: m.endAt,
			monitors: m.monitors,
			activities: [],
			detailsLink: buildPath(`/maintenance/${m.id}`, slug),
		})),
	].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	const design = (pageConfig.design as any) || {};

	return (
		<div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
			<Header
				title={pageConfig.name}
				logoUrl={design.logoUrl}
				contactUrl={design.contactUrl}
			/>

			<main className="w-full flex-1">
				<div className="mx-auto max-w-5xl px-4 py-12">
					<div className="mb-8">
						<Link
							href={`/${slug}` as any}
							className="inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
						>
							<ChevronLeft className="h-4 w-4" />
							Back to status
						</Link>
						<h1 className="mt-4 font-bold text-3xl">
							Updated & Maintenance History
						</h1>
					</div>

					{combinedActive.length > 0 && (
						<section className="mb-12 animate-slide-up">
							<h2 className="mb-6 flex items-center gap-3 font-bold text-foreground/80 text-lg">
								<span className="relative flex h-2.5 w-2.5">
									<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
									<span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
								</span>
								Current Issues
							</h2>
							<div className="space-y-6">
								{combinedActive.map((item) => (
									<IncidentCard
										key={item.id}
										incident={item as any}
										isExpanded={true}
										detailsLink={(item as any).detailsLink}
										className="bg-card shadow-sm"
									/>
								))}
							</div>
							<div className="my-8 h-px bg-border" />
						</section>
					)}

					<div className="space-y-12">
						{Object.keys(incidentsByDate).length === 0 ? (
							<p className="text-muted-foreground">No updates found.</p>
						) : (
							Object.entries(incidentsByDate).map(
								([date, incidents]: [string, any]) => (
									<div key={date}>
										<div className="sticky top-0 z-10 mb-4 border-border border-b bg-background/95 pb-2 font-medium text-muted-foreground text-sm backdrop-blur">
											{date}
										</div>
										<div className="space-y-4">
											{incidents.map((incident: any) => (
												<IncidentCard
													key={incident.id}
													incident={incident}
													isExpanded={false}
													detailsLink={(incident as any).detailsLink}
													className="border-none bg-card/50 shadow-none hover:bg-card/80"
												/>
											))}
										</div>
									</div>
								),
							)
						)}
					</div>
				</div>
			</main>
			<Footer />
		</div>
	);
}
