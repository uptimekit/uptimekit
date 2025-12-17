"use client";

import { useQuery } from "@tanstack/react-query";
import {
	AlertOctagon,
	AlertTriangle,
	ArrowLeft,
	CheckCircle,
	Pencil,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AddUpdateForm } from "@/components/status-pages/add-update-form";
import { EditUpdateForm } from "@/components/status-pages/edit-update-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { orpc } from "@/utils/orpc";

export default function IncidentDetailsPage() {
	const params = useParams();
	const router = useRouter();
	const statusPageId = params.statusPageId as string;
	const reportId = params.reportId as string;

	const [editingUpdate, setEditingUpdate] = useState<{
		id: string;
		message: string;
		status: string;
	} | null>(null);

	const { data: report, isLoading } = useQuery(
		orpc.statusUpdates.get.queryOptions({
			input: { statusPageId, reportId },
		}),
	);

	const getSeverityIcon = (severity: string, status: string) => {
		if (status === "resolved") {
			return <CheckCircle className="h-5 w-5 text-green-500" />;
		}

		switch (severity) {
			case "critical":
				return <AlertOctagon className="h-5 w-5 text-red-500" />;
			case "major":
				return <AlertTriangle className="h-5 w-5 text-orange-500" />;
			case "minor":
				return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
			default:
				return <CheckCircle className="h-5 w-5 text-green-500" />;
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "investigating":
				return "bg-red-500 ring-red-100 dark:ring-red-900/30";
			case "identified":
				return "bg-orange-500 ring-orange-100 dark:ring-orange-900/30";
			case "monitoring":
				return "bg-blue-500 ring-blue-100 dark:ring-blue-900/30";
			case "resolved":
				return "bg-green-500 ring-green-100 dark:ring-green-900/30";
			default:
				return "bg-gray-500 ring-gray-100 dark:ring-gray-900/30";
		}
	};

	if (isLoading) {
		return (
			<div className="p-8 text-center text-muted-foreground">Loading...</div>
		);
	}

	if (!report) {
		return (
			<div className="p-8 text-center text-destructive">Report not found</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-4">
				<Button
					variant="ghost"
					size="icon"
					onClick={() =>
						router.push(`/status-pages/${statusPageId}/status-updates`)
					}
				>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<div>
					<h2 className="flex items-center gap-2 font-medium text-xl">
						{getSeverityIcon(report.severity, report.status)}
						{report.title}
					</h2>
					<p className="text-muted-foreground text-sm">
						Started on {new Date(report.createdAt).toLocaleString()}
					</p>
				</div>
				<Badge variant="outline" className="ml-auto capitalize">
					{report.status}
				</Badge>
			</div>

			<div className="grid gap-6 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_350px]">
				<div className="space-y-6">
					<AddUpdateForm
						statusPageId={statusPageId}
						reportId={reportId}
						currentStatus={report.status}
						initialMonitors={report.affectedMonitors.map((m) => ({
							id: m.monitorId,
							status: m.status || "degraded",
						}))}
						onSuccess={() => {
							// Optional: scroll to top or show toast (handled in form)
						}}
					/>
				</div>

				<div className="space-y-6">
					<h3 className="font-medium text-lg">Timeline</h3>
					<div className="relative ml-3 space-y-8 border-l-2 pl-6">
						{report.updates.map((update, index) => (
							<div key={update.id} className="group relative">
								{/* Mask the timeline line for the last item */}
								{index === report.updates.length - 1 && (
									<div
										className="-left-[27px] absolute top-3.5 h-full w-2 bg-background"
										aria-hidden="true"
									/>
								)}
								<div
									className={`-left-[31px] absolute top-1.5 h-3 w-3 rounded-full ring-4 ${getStatusColor(update.status)}`}
								/>
								<div className="mb-2 flex flex-col gap-1">
									<div className="flex items-center justify-between gap-2">
										<div className="flex items-center gap-2">
											<Badge variant="secondary" className="text-xs uppercase">
												{update.status}
											</Badge>
											<span className="text-muted-foreground text-xs">
												{new Date(update.createdAt).toLocaleString()}
											</span>
										</div>
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
											onClick={() =>
												setEditingUpdate({
													id: update.id,
													message: update.message,
													status: update.status,
												})
											}
										>
											<Pencil className="h-3 w-3 text-muted-foreground" />
										</Button>
									</div>
								</div>
								<div className="prose prose-sm dark:prose-invert max-w-none text-sm">
									<p className="whitespace-pre-wrap leading-relaxed">
										{update.message}
									</p>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>

			<Dialog
				open={!!editingUpdate}
				onOpenChange={(open) => !open && setEditingUpdate(null)}
			>
				<DialogContent className="max-w-xl">
					<DialogHeader>
						<DialogTitle>Edit Update</DialogTitle>
					</DialogHeader>
					{editingUpdate && (
						<EditUpdateForm
							statusPageId={statusPageId}
							updateId={editingUpdate.id}
							reportId={reportId}
							initialValues={{
								message: editingUpdate.message,
								status: editingUpdate.status,
								monitors: report.affectedMonitors.map((m) => ({
									id: m.monitorId,
									status: m.status || "degraded",
								})),
							}}
							onSuccess={() => setEditingUpdate(null)}
							onCancel={() => setEditingUpdate(null)}
						/>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
