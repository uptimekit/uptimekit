"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertOctagon,
	AlertTriangle,
	CheckCircle,
	ChevronDown,
	MessageSquare,
	MoreHorizontal,
	Plus,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { CreateStatusUpdateForm } from "@/components/status-pages/create-update-form";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { client, orpc } from "@/utils/orpc";

export default function StatusUpdatesPage() {
	const params = useParams();
	const router = useRouter();
	const statusPageId = params.statusPageId as string;
	const [createOpen, setCreateOpen] = useState(false);
	const queryClient = useQueryClient();
	const [deleteReportId, setDeleteReportId] = useState<string | null>(null);

	const { data: updates, isLoading } = useQuery(
		orpc.statusUpdates.list.queryOptions({
			input: { statusPageId },
		}),
	);

	const getSeverityIcon = (severity: string, status: string) => {
		if (status === "resolved") {
			return <CheckCircle className="h-4 w-4 text-green-500" />;
		}

		switch (severity) {
			case "critical":
				return <AlertOctagon className="h-4 w-4 text-red-500" />;
			case "major":
				return <AlertTriangle className="h-4 w-4 text-orange-500" />;
			case "minor":
				return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
			default:
				return <CheckCircle className="h-4 w-4 text-green-500" />;
		}
	};

	const { mutate: deleteReport, isPending: isDeleting } = useMutation({
		mutationFn: (reportId: string) =>
			client.statusUpdates.deleteReport({
				statusPageId,
				reportId,
			}),
		onSuccess: () => {
			toast.success("Status update deleted successfully");
			queryClient.invalidateQueries({
				queryKey: orpc.statusUpdates.list.key(),
			});
		},
		onError: (error: Error) => {
			toast.error(`Failed to delete status update: ${error.message}`);
		},
	});

	if (isLoading) {
		return (
			<div className="flex w-full items-center justify-center p-8">
				<div className="text-muted-foreground">Loading...</div>
			</div>
		);
	}

	return (
		<>
			<div className="space-y-6">
				<CreateStatusUpdateForm
					statusPageId={statusPageId}
					open={createOpen}
					onOpenChange={setCreateOpen}
				/>

				<div className="flex items-center justify-between">
					<div>
						<h2 className="font-medium text-lg">Status Updates</h2>
						<p className="text-muted-foreground text-sm">
							Post updates about incidents and service status.
						</p>
					</div>
					<Button
						size="sm"
						className="gap-2"
						onClick={() => setCreateOpen(true)}
					>
						<Plus className="h-4 w-4" /> Post update
					</Button>
				</div>

				<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
					<div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-3 font-medium text-muted-foreground text-sm">
						<ChevronDown className="h-4 w-4" />
						Updates
					</div>
					<Table>
						<TableBody>
							{isLoading ? (
								<TableRow>
									<TableCell colSpan={4} className="h-24 text-center">
										Loading...
									</TableCell>
								</TableRow>
							) : updates?.length === 0 ? (
								<TableRow>
									<TableCell colSpan={4} className="h-24 text-center">
										<div className="flex flex-col items-center justify-center gap-2 py-6">
											<div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
												<MessageSquare className="h-6 w-6 text-muted-foreground" />
											</div>
											<p className="font-medium text-lg">No updates found</p>
											<p className="text-muted-foreground text-sm">
												Keep your users in the loop by posting status updates.
											</p>
											<div className="mt-2">
												<Button onClick={() => setCreateOpen(true)}>
													Post update
												</Button>
											</div>
										</div>
									</TableCell>
								</TableRow>
							) : (
								updates?.map((report) => (
									<TableRow
										key={report.id}
										className="group h-[72px] cursor-pointer hover:bg-muted/40"
										onClick={() =>
											router.push(
												`/status-pages/${statusPageId}/status-updates/${report.id}`,
											)
										}
									>
										<TableCell className="w-[50px] pl-6 text-center">
											{getSeverityIcon(report.severity, report.status)}
										</TableCell>
										<TableCell>
											<div className="grid gap-1">
												<span className="font-semibold leading-none transition-colors group-hover:text-primary">
													{report.title}
												</span>
												<div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
													<span
														className={cn(
															"capitalize",
															report.status === "resolved" &&
																"text-emerald-500",
															report.status === "investigating" &&
																"text-red-500",
															report.status === "identified" &&
																"text-orange-500",
															report.status === "monitoring" && "text-blue-500",
														)}
													>
														{report.status}
													</span>
													<span>·</span>
													<span>
														{new Date(report.createdAt).toLocaleDateString(
															undefined,
															{
																month: "short",
																day: "numeric",
															},
														)}
													</span>
													<span>·</span>
													<div className="flex items-center gap-1">
														<MessageSquare className="h-3 w-3" />
														<span>{report.updates.length} updates</span>
													</div>
												</div>
											</div>
										</TableCell>
										<TableCell className="w-[100px] text-right">
											{/* Spacer to match maintenance layout */}
										</TableCell>
										<TableCell className="w-[50px] pr-4">
											<DropdownMenu>
												<DropdownMenuTrigger>
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
														onClick={(e) => e.stopPropagation()}
													>
														<MoreHorizontal className="h-4 w-4" />
														<span className="sr-only">Open menu</span>
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														onClick={(e) => e.stopPropagation()}
													>
														<Link
															href={`/status-pages/${statusPageId}/status-updates/${report.id}`}
														>
															Manage
														</Link>
													</DropdownMenuItem>
													<DropdownMenuItem
														className="text-red-500"
														onClick={(e) => {
															e.stopPropagation();
															setDeleteReportId(report.id);
														}}
														disabled={isDeleting}
													>
														Delete
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</div>

			<AlertDialog
				open={!!deleteReportId}
				onOpenChange={(open) => !open && setDeleteReportId(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete status update?</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete this status update? This will
							delete all updates and cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (deleteReportId) {
									deleteReport(deleteReportId);
									setDeleteReportId(null);
								}
							}}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
