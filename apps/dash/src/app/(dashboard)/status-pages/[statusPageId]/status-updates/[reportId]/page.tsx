"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
	ArrowLeft,
	CheckCircle,
	AlertTriangle,
	AlertOctagon,
	Pencil,
	Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { orpc, client } from "@/utils/orpc";
import { Badge } from "@/components/ui/badge";
import { AddUpdateForm } from "@/components/status-pages/add-update-form";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function IncidentDetailsPage() {
	const params = useParams();
	const router = useRouter();
	const queryClient = useQueryClient();
	const statusPageId = params.statusPageId as string;
	const reportId = params.reportId as string;

	const [editingUpdate, setEditingUpdate] = useState<{
		id: string;
		message: string;
	} | null>(null);

	const { data: report, isLoading } = useQuery(
		orpc.statusUpdates.get.queryOptions({
			input: { statusPageId, reportId },
		}),
	);

	const editMutation = useMutation({
		mutationFn: (data: { updateId: string; message: string }) =>
			client.statusUpdates.editUpdate({
				statusPageId,
				updateId: data.updateId,
				message: data.message,
			}),
		onSuccess: () => {
			toast.success("Update edited successfully");
			queryClient.invalidateQueries({
				queryKey: orpc.statusUpdates.get.key({ statusPageId, reportId }),
			});
			setEditingUpdate(null);
		},
		onError: (error: Error) => {
			toast.error(`Failed to edit update: ${error.message}`);
		},
	});

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
					<h2 className="text-xl font-medium flex items-center gap-2">
						{getSeverityIcon(report.severity, report.status)}
						{report.title}
					</h2>
					<p className="text-sm text-muted-foreground">
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
					<div className="relative space-y-8 border-l-2 pl-6 ml-3">
						{report.updates.map((update, index) => (
							<div key={update.id} className="relative group">
								{/* Mask the timeline line for the last item */}
								{index === report.updates.length - 1 && (
									<div
										className="absolute -left-[27px] top-3.5 h-full w-2 bg-background"
										aria-hidden="true"
									/>
								)}
								<div className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full bg-border ring-4 ring-background" />
								<div className="mb-2 flex flex-col gap-1">
									<div className="flex items-center justify-between gap-2">
										<div className="flex items-center gap-2">
											<Badge variant="secondary" className="text-xs uppercase">
												{update.status}
											</Badge>
											<span className="text-xs text-muted-foreground">
												{new Date(update.createdAt).toLocaleString()}
											</span>
										</div>
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
											onClick={() =>
												setEditingUpdate({
													id: update.id,
													message: update.message,
												})
											}
										>
											<Pencil className="h-3 w-3 text-muted-foreground" />
										</Button>
									</div>
								</div>
								<div className="text-sm prose prose-sm dark:prose-invert max-w-none">
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
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit Update</DialogTitle>
						<DialogDescription>
							Change the message for this timeline update.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="message">Message</Label>
							<Textarea
								id="message"
								value={editingUpdate?.message || ""}
								onChange={(e) =>
									setEditingUpdate((prev) =>
										prev ? { ...prev, message: e.target.value } : null,
									)
								}
								rows={5}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setEditingUpdate(null)}
							disabled={editMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							onClick={() => {
								if (editingUpdate) {
									editMutation.mutate({
										updateId: editingUpdate.id,
										message: editingUpdate.message,
									});
								}
							}}
							disabled={editMutation.isPending}
						>
							{editMutation.isPending && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							Save custom message
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
