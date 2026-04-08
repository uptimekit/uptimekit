"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Clock, MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { sileo } from "sileo";
import { CreateMaintenanceForm } from "@/components/status-pages/create-maintenance-form";
import {
	AlertDialog,
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

export default function MaintenancePage() {
	const params = useParams();
	const statusPageId = params.statusPageId as string;
	const [createOpen, setCreateOpen] = useState(false);
	const queryClient = useQueryClient();
	const [deleteMaintenanceId, setDeleteMaintenanceId] = useState<string | null>(
		null,
	);

	const { data: maintenanceRecords, isLoading } = useQuery(
		orpc.maintenance.list.queryOptions({
			input: { statusPageId },
		}),
	);

	const { mutate: deleteMaintenance, isPending: isDeleting } = useMutation({
		mutationFn: (maintenanceId: string) =>
			client.maintenance.delete({
				maintenanceId,
			}),
		onSuccess: () => {
			sileo.success({ title: "Maintenance deleted successfully" });
			queryClient.invalidateQueries({
				queryKey: orpc.maintenance.list.key(),
			});
			setDeleteMaintenanceId(null);
		},
		onError: (error: Error) => {
			sileo.error({ title: `Failed to delete maintenance: ${error.message}` });
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
				<CreateMaintenanceForm
					statusPageId={statusPageId}
					open={createOpen}
					onOpenChange={setCreateOpen}
				/>

				<div className="flex items-center justify-between">
					<div>
						<h2 className="font-medium text-lg">Maintenance</h2>
						<p className="text-muted-foreground text-sm">
							Schedule maintenance windows to keep your users informed.
						</p>
					</div>
					<Button
						size="sm"
						className="gap-2"
						onClick={() => setCreateOpen(true)}
					>
						<Plus className="h-4 w-4" /> Schedule maintenance
					</Button>
				</div>

				<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
					<div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-3 font-medium text-muted-foreground text-sm">
						<ChevronDown className="h-4 w-4" />
						Maintenance
					</div>
					<Table>
						<TableBody>
							{isLoading ? (
								<TableRow>
									<TableCell colSpan={4} className="h-24 text-center">
										Loading...
									</TableCell>
								</TableRow>
							) : maintenanceRecords?.length === 0 ? (
								<TableRow>
									<TableCell colSpan={4} className="h-24 text-center">
										<div className="flex flex-col items-center justify-center gap-2 py-6">
											<div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
												<Plus className="h-6 w-6 text-muted-foreground" />
											</div>
											<p className="font-medium text-lg">
												No maintenance scheduled
											</p>
											<p className="text-muted-foreground text-sm">
												Get started by creating your first maintenance window.
											</p>
											<div className="mt-2">
												<Button onClick={() => setCreateOpen(true)}>
													Schedule maintenance
												</Button>
											</div>
										</div>
									</TableCell>
								</TableRow>
							) : (
								maintenanceRecords?.map((maintenance) => (
									<TableRow
										key={maintenance.id}
										className="group h-[72px] hover:bg-muted/40"
									>
										<TableCell className="w-[50px] pl-6">
											<div
												className={cn(
													"h-2.5 w-2.5 rounded-full shadow-sm",
													maintenance.status === "completed" &&
														"bg-emerald-500 shadow-emerald-500/20",
													maintenance.status === "in_progress" &&
														"bg-blue-500 shadow-blue-500/20",
													maintenance.status === "scheduled" &&
														"bg-zinc-500 shadow-zinc-500/20",
												)}
											/>
										</TableCell>
										<TableCell>
											<Link
												href={`/status-pages/${statusPageId}/maintenance/${maintenance.id}`}
												className="block h-full w-full"
											>
												<div className="grid gap-1">
													<span className="flex items-center gap-2 font-semibold leading-none transition-colors group-hover:text-primary">
														{maintenance.title}
													</span>
													<div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
														<span
															className={cn(
																maintenance.status === "completed" &&
																	"text-emerald-500",
																maintenance.status === "in_progress" &&
																	"text-blue-500",
																maintenance.status === "scheduled" &&
																	"text-zinc-500",
															)}
														>
															{maintenance.status === "completed"
																? "Completed"
																: maintenance.status === "in_progress"
																	? "In Progress"
																	: "Scheduled"}
														</span>
														<span>·</span>
														<span>
															{new Date(maintenance.startAt).toLocaleDateString(
																undefined,
																{
																	month: "short",
																	day: "numeric",
																	hour: "numeric",
																	minute: "numeric",
																},
															)}
														</span>
														<span>·</span>
														<div className="flex items-center gap-1">
															<Clock className="h-3 w-3" />
															<span>
																{new Date(
																	maintenance.startAt,
																).toLocaleTimeString([], {
																	hour: "2-digit",
																	minute: "2-digit",
																})}
															</span>
														</div>
													</div>
												</div>
											</Link>
										</TableCell>
										<TableCell className="w-[100px] text-right">
											{/* Placeholder for future specific columns or just spacing */}
										</TableCell>
										<TableCell className="w-[50px] pr-4">
											<DropdownMenu>
												<DropdownMenuTrigger>
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
													>
														<MoreHorizontal className="h-4 w-4" />
														<span className="sr-only">Open menu</span>
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem>
														<Link
															href={`/status-pages/${statusPageId}/maintenance/${maintenance.id}`}
														>
															View details
														</Link>
													</DropdownMenuItem>
													<DropdownMenuItem
														className="text-red-500"
														onClick={() =>
															setDeleteMaintenanceId(maintenance.id)
														}
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
				open={!!deleteMaintenanceId}
				onOpenChange={(open) => !open && setDeleteMaintenanceId(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete maintenance?</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete this maintenance window? This will
							delete all updates and cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<Button
							type="button"
							onClick={() => {
								if (deleteMaintenanceId) {
									deleteMaintenance(deleteMaintenanceId);
								}
							}}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Delete
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
