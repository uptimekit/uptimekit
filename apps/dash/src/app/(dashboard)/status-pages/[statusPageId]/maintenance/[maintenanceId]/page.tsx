"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	ArrowLeft,
	Calendar,
	CheckCircle,
	Clock,
	ExternalLink,
	Megaphone,
	Pencil,
	Wrench,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { AddMaintenanceUpdateForm } from "@/components/status-pages/add-maintenance-update-form";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogPanel,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { client, orpc } from "@/utils/orpc";

export default function MaintenanceDetailsPage() {
	const params = useParams();
	const router = useRouter();
	const maintenanceId = params.maintenanceId as string;
	const [editingUpdate, setEditingUpdate] = useState<{
		id: string;
		message: string;
		status: string;
	} | null>(null);
	const [editingWindow, setEditingWindow] = useState(false);

	const { data: maintenance, isLoading } = useQuery(
		orpc.maintenance.get.queryOptions({
			input: { maintenanceId },
		}),
	);

	if (isLoading) {
		return (
			<div className="p-8 text-center text-muted-foreground">Loading...</div>
		);
	}

	if (!maintenance) {
		return (
			<div className="p-8 text-center text-destructive">
				Maintenance not found
			</div>
		);
	}

	function getStatusIcon(status: string) {
		switch (status) {
			case "in_progress":
				return <Wrench className="h-5 w-5 text-blue-500" />;
			case "completed":
				return <CheckCircle className="h-5 w-5 text-green-500" />;
			case "scheduled":
				return <Calendar className="h-5 w-5 text-orange-500" />;
			default:
				return <Megaphone className="h-5 w-5 text-gray-500" />;
		}
	}

	function getTimelineStatusColor(status: string) {
		switch (status) {
			case "in_progress":
				return "bg-blue-500 ring-blue-100 dark:ring-blue-900/30";
			case "completed":
				return "bg-green-500 ring-green-100 dark:ring-green-900/30";
			case "scheduled":
				return "bg-orange-500 ring-orange-100 dark:ring-orange-900/30";
			default:
				return "bg-gray-500 ring-gray-100 dark:ring-gray-900/30";
		}
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center gap-4">
				<Button
					variant="ghost"
					size="icon"
					onClick={() => {
						router.back();
					}}
				>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<div>
					<h2 className="flex items-center gap-2 font-medium text-xl">
						{getStatusIcon(maintenance.status)}
						{maintenance.title}
					</h2>
					<p className="text-muted-foreground text-sm">
						Started on {new Date(maintenance.startAt).toLocaleString()}
					</p>
				</div>
				<Badge variant="outline" className="ml-auto capitalize">
					{maintenance.status.replace("_", " ")}
				</Badge>
			</div>

			<div className="grid gap-6 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_350px]">
				<div className="space-y-8">
					<AddMaintenanceUpdateForm
						maintenanceId={maintenanceId}
						currentStatus={maintenance.status}
					/>

					<div className="space-y-6">
						<h3 className="font-medium text-lg">Timeline</h3>
						{maintenance.updates && maintenance.updates.length > 0 ? (
							<div className="relative ml-3 space-y-8 border-l-2 pl-6">
								{maintenance.updates.map((update, index) => (
									<div key={update.id} className="group relative">
										{/* Mask the timeline line for the last item */}
										{maintenance.updates &&
											index === maintenance.updates.length - 1 && (
												<div
													className="absolute top-3.5 -left-[27px] h-full w-2 bg-background"
													aria-hidden="true"
												/>
											)}
										<div
											className={`absolute top-1.5 -left-[31px] h-3 w-3 rounded-full ring-4 ${getTimelineStatusColor(update.status)}`}
										/>
										<div className="mb-2 flex flex-col gap-1">
											<div className="flex items-center justify-between gap-2">
												<div className="flex items-center gap-2">
													<Badge
														variant="secondary"
														className="text-xs uppercase"
													>
														{update.status.replace("_", " ")}
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
						) : (
							<div className="text-muted-foreground text-sm">
								No updates yet.
							</div>
						)}
					</div>
				</div>

				<div className="space-y-6">
					{/* Window Info */}
					<Card className="gap-3 py-4">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 px-6 pb-0">
							<CardTitle className="font-medium text-muted-foreground text-sm">
								Window
							</CardTitle>
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6"
								onClick={() => setEditingWindow(true)}
							>
								<Pencil className="h-3 w-3" />
							</Button>
						</CardHeader>
						<CardContent className="space-y-4 px-6">
							<div className="flex items-start gap-3">
								<Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
								<div className="space-y-0.5">
									<span className="font-medium text-muted-foreground text-xs uppercase">
										Start
									</span>
									<p className="font-medium text-sm">
										{format(new Date(maintenance.startAt), "MMM d, yyyy")}
									</p>
									<p className="text-muted-foreground text-sm">
										{format(new Date(maintenance.startAt), "h:mm a")}
									</p>
								</div>
							</div>
							<Separator />
							<div className="flex items-start gap-3">
								<Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
								<div className="space-y-0.5">
									<span className="font-medium text-muted-foreground text-xs uppercase">
										End
									</span>
									<p className="font-medium text-sm">
										{format(new Date(maintenance.endAt), "MMM d, yyyy")}
									</p>
									<p className="text-muted-foreground text-sm">
										{format(new Date(maintenance.endAt), "h:mm a")}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Affected Services */}
					{maintenance.monitors.length > 0 && (
						<Card className="gap-3 py-4">
							<CardHeader className="px-6 pb-0">
								<CardTitle className="font-medium text-muted-foreground text-sm">
									Affected Services
								</CardTitle>
							</CardHeader>
							<CardContent className="px-6">
								<div className="space-y-1">
									{maintenance.monitors.map((m) => (
										<Link
											key={m.monitor.id}
											href={`/monitors/${m.monitor.id}`}
											className="group flex items-center gap-1.5 font-medium text-sm transition-colors hover:text-primary"
										>
											<span>{m.monitor.name}</span>
											<ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 transition-all group-hover:opacity-100" />
										</Link>
									))}
								</div>
							</CardContent>
						</Card>
					)}
				</div>
			</div>

			<EditUpdateDialog
				update={editingUpdate}
				open={!!editingUpdate}
				onOpenChange={(open) => !open && setEditingUpdate(null)}
			/>

			<EditWindowDialog
				maintenanceId={maintenance.id}
				startAt={new Date(maintenance.startAt)}
				endAt={new Date(maintenance.endAt)}
				open={editingWindow}
				onOpenChange={setEditingWindow}
			/>
		</div>
	);
}

function EditUpdateDialog({
	update,
	open,
	onOpenChange,
}: {
	update: { id: string; message: string; status: string } | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const form = useForm({
		defaultValues: {
			message: update?.message || "",
			status: update?.status || "in_progress",
		},
	});

	// Reset form when update changes
	useEffect(() => {
		if (update) {
			form.reset({
				message: update.message,
				status: update.status,
			});
		}
	}, [update, form]);

	const { mutate: updateUpdate, isPending } = useMutation({
		mutationFn: async (values: { message: string; status: string }) => {
			if (!update) return;
			await client.maintenance.updateUpdate({
				updateId: update.id,
				message: values.message,
				status: values.status as "scheduled" | "in_progress" | "completed",
			});
		},
		onSuccess: () => {
			toast.success("Update saved");
			queryClient.invalidateQueries({
				queryKey: orpc.maintenance.get.key(),
			});
			onOpenChange(false);
		},
		onError: () => {
			toast.error("Failed to save update");
		},
	});

	const { mutate: deleteUpdate, isPending: isDeleting } = useMutation({
		mutationFn: async () => {
			if (!update) return;
			await client.maintenance.deleteUpdate({
				updateId: update.id,
			});
		},
		onSuccess: () => {
			toast.success("Update deleted");
			queryClient.invalidateQueries({
				queryKey: orpc.maintenance.get.key(),
			});
			onOpenChange(false);
		},
		onError: () => {
			toast.error("Failed to delete update");
		},
	});

	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	const onSubmit = (values: { message: string; status: string }) => {
		updateUpdate(values);
	};

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>Edit maintenance update</DialogTitle>
						<DialogDescription>
							Update the message for this status update.
						</DialogDescription>
					</DialogHeader>
					<DialogPanel>
						<Form {...form}>
							<form
								onSubmit={form.handleSubmit(onSubmit)}
								className="space-y-4"
							>
								<FormField
									control={form.control}
									name="message"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Message</FormLabel>
											<FormControl>
												<Textarea
													{...field}
													rows={5}
													placeholder="Message..."
													className="resize-none"
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="status"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Status</FormLabel>
											<Select
												onValueChange={field.onChange}
												defaultValue={field.value}
											>
												<FormControl>
													<SelectTrigger className="w-full">
														<SelectValue placeholder="Status" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													<SelectItem value="scheduled">Scheduled</SelectItem>
													<SelectItem value="in_progress">
														In Progress
													</SelectItem>
													<SelectItem value="completed">Completed</SelectItem>
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>

								<div className="flex justify-between gap-2 pt-2">
									<Button
										type="button"
										variant="destructive"
										onClick={() => setShowDeleteDialog(true)}
										disabled={isPending || isDeleting}
									>
										Delete
									</Button>
									<div className="flex gap-2">
										<Button
											type="button"
											variant="ghost"
											onClick={() => onOpenChange(false)}
											disabled={isPending || isDeleting}
										>
											Cancel
										</Button>
										<Button type="submit" disabled={isPending || isDeleting}>
											{isPending ? "Saving..." : "Save changes"}
										</Button>
									</div>
								</div>
							</form>
						</Form>
					</DialogPanel>
				</DialogContent>
			</Dialog>

			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete update?</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete this update? This action cannot be
							undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								deleteUpdate();
								setShowDeleteDialog(false);
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

function EditWindowDialog({
	maintenanceId,
	startAt,
	endAt,
	open,
	onOpenChange,
}: {
	maintenanceId: string;
	startAt: Date;
	endAt: Date;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const form = useForm({
		defaultValues: {
			startAt: startAt,
			endAt: endAt,
		},
	});

	const { mutate: updateMaintenance, isPending } = useMutation({
		mutationFn: async (values: { startAt: Date; endAt: Date }) => {
			await client.maintenance.update({
				maintenanceId,
				startAt: values.startAt.toISOString(),
				endAt: values.endAt.toISOString(),
			});
		},
		onSuccess: () => {
			toast.success("Maintenance window updated");
			queryClient.invalidateQueries({
				queryKey: orpc.maintenance.get.key(),
			});
			onOpenChange(false);
		},
		onError: () => {
			toast.error("Failed to update maintenance window");
		},
	});

	const onSubmit = (values: { startAt: Date; endAt: Date }) => {
		updateMaintenance(values);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="overflow-visible sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Edit maintenance window</DialogTitle>
					<DialogDescription>
						Update the start and end time for this maintenance.
					</DialogDescription>
				</DialogHeader>
				<DialogPanel>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
							<FormField
								control={form.control}
								name="startAt"
								render={({ field }) => (
									<FormItem className="flex flex-col">
										<FormLabel>Start time</FormLabel>
										<FormControl>
											<DateTimePicker
												date={field.value}
												setDate={field.onChange}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="endAt"
								render={({ field }) => (
									<FormItem className="flex flex-col">
										<FormLabel>End time</FormLabel>
										<FormControl>
											<DateTimePicker
												date={field.value}
												setDate={field.onChange}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<div className="flex justify-end gap-2 pt-2">
								<Button
									type="button"
									variant="ghost"
									onClick={() => onOpenChange(false)}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={isPending}>
									{isPending ? "Saving..." : "Save changes"}
								</Button>
							</div>
						</form>
					</Form>
				</DialogPanel>
			</DialogContent>
		</Dialog>
	);
}
