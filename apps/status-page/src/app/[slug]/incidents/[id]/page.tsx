import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { IncidentCard } from "@/components/incident-card";
import {
	getActiveMaintenances,
	getActiveStatusPageReports,
	getStatusPageBySlug,
	getStatusPageReports,
} from "@/lib/db-queries";
import { buildPath } from "@/lib/route-utils";

export default async function SlugIncidentDetailsPage({
	params,
}: {
	params: Promise<{ slug: string; id: string }>;
}) {
	const { slug, id } = await params;

	const pageConfig = await getStatusPageBySlug(slug);

	if (!pageConfig) {
		notFound();
	}

	const [reports, activeReports, activeMaintenances] = await Promise.all([
		getStatusPageReports(pageConfig.id, 1000),
		getActiveStatusPageReports(pageConfig.id),
		getActiveMaintenances(pageConfig.id),
	]);

	const reportItem =
		activeReports.find((r) => r.id === id) || reports.find((r) => r.id === id);

	if (!reportItem) {
		notFound();
	}

	const incidentData = {
		id: reportItem.id,
		title: reportItem.title,
		status: reportItem.status,
		severity: reportItem.severity,
		createdAt: reportItem.createdAt,
		resolvedAt: reportItem.resolvedAt,
		monitors: reportItem.affectedMonitors.map((am: any) => ({
			monitor: am.monitor,
		})),
		activities: reportItem.updates.map((u: any) => ({
			id: u.id,
			message: u.message,
			createdAt: u.createdAt,
			type: "update",
		})),
		detailsLink: buildPath(`/incidents/${reportItem.id}`, slug),
	};

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
				<div className="mx-auto max-w-3xl px-4 py-12">
					<div className="mb-8">
						<Link
							href={`/${slug}` as any}
							className="inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
						>
							<ChevronLeft className="h-4 w-4" />
							Back to status
						</Link>
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
										className="border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
									/>
								))}
							</div>
							<div className="my-8 h-px bg-border" />
						</section>
					)}

					<div className="opacity-80">
						<div className="mb-2 font-medium text-muted-foreground text-sm uppercase tracking-wider">
							Previous Incident Report
						</div>
						<IncidentCard
							incident={incidentData}
							isExpanded={true}
							className="border-border bg-card shadow-sm"
						/>
					</div>
				</div>
			</main>
			<Footer />
		</div>
	);
}
