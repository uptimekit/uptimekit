"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
	ArrowLeft,
	Calendar,
	CheckCircle,
	Clock,
	ExternalLink,
	Megaphone,
	MoreHorizontal,
	Pencil,
	Plus,
	Trash,
	Wrench,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { client, orpc } from "@/utils/orpc";

const updateSchema = z.object({
	message: z.string().min(1, "Message is required"),
	status: z.enum(["scheduled", "in_progress", "completed"]),
});

type UpdateFormValues = z.infer<typeof updateSchema>;

export default function MaintenanceDetailsPage() {
	const params = useParams();
	const router = useRouter();
	const maintenanceId = params.maintenanceId as string;
	const [editingUpdate, setEditingUpdate] = useState<{
		id: string;
		message: string;
		status: string;
	} | null>(null);
	const [postOpen, setPostOpen] = useState(false);
	const [editingWindow, setEditingWindow] = useState(false);

	const { data: maintenance, isLoading } = useQuery(
		orpc.maintenance.get.queryOptions({
			input: { maintenanceId },
		}),
	);

	if (isLoading) {
		return (
			<div className="py-8 text-center text-muted-foreground">Loading...</div>
		);
	}

	if (!maintenance) {
		return <div>Maintenance not found</div>;
	}

	function getStatusColor(status: string) {
		switch (status) {
			case "in_progress":
				return "bg-blue-500/10 border-blue-500/20 text-blue-500";
			case "completed":
				return "bg-emerald-500/10 border-emerald-500/20 text-emerald-500";
			case "scheduled":
				return "bg-orange-500/10 border-orange-500/20 text-orange-500";
			default:
				return "bg-gray-500/10 border-gray-500/20 text-gray-500";
		}
	}

	function getStatusIcon(status: string) {
		switch (status) {
			case "in_progress":
				return <Wrench className="h-4 w-4" />;
			case "completed":
				return <CheckCircle className="h-4 w-4" />;
			case "scheduled":
				return <Calendar className="h-4 w-4" />;
			default:
				return <Megaphone className="h-4 w-4" />;
		}
	}

	return (
		<div className="mx-auto w-full max-w-[1600px] space-y-8 pb-12">
			{/* Navigation & Header */}
			<div className="space-y-4">
				<Button
					variant="ghost"
					className="-ml-2 w-fit gap-2 text-muted-foreground hover:text-foreground"
					onClick={() => router.back()}
				>
					<ArrowLeft className="h-4 w-4" />
					Back to overview
				</Button>

				<div className="flex items-start justify-between gap-4">
					<div className="space-y-2">
						<div className="flex items-center gap-3">
							<Badge
								variant="outline"
								className={cn(
									"flex items-center gap-1.5 px-2.5 py-0.5 font-medium text-sm capitalize shadow-none transition-colors",
									getStatusColor(maintenance.status),
								)}
							>
								{getStatusIcon(maintenance.status)}
								{maintenance.status.replace("_", " ")}
							</Badge>
							<span className="text-muted-foreground text-sm">
								{format(new Date(maintenance.startAt), "MMM d, yyyy")}
							</span>
						</div>
						<h1 className="font-bold text-3xl tracking-tight md:text-4xl">
							{maintenance.title}
						</h1>
					</div>
				</div>
			</div>

			<div className="grid gap-8 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					<div className="flex items-center justify-between">
						<h2 className="font-semibold text-xl tracking-tight">Timeline</h2>
						{maintenance.status !== "completed" && (
							<Button size="sm" onClick={() => setPostOpen(true)}>
								<Plus className="mr-2 h-4 w-4" />
								Post update
							</Button>
						)}
					</div>

					<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
						<div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-3 font-medium text-muted-foreground text-sm">
							<Megaphone className="h-4 w-4" />
							Maintenance updates
						</div>
						<Table>
							<TableBody>
								{maintenance.updates?.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={3}
											className="h-24 text-center text-muted-foreground"
										>
											No updates yet.
										</TableCell>
									</TableRow>
								) : (
									maintenance.updates?.map((update) => (
										<TableRow
											key={update.id}
											className="group transition-colors hover:bg-muted/40"
										>
											<TableCell className="w-[50px] py-4 pl-6 align-top">
												<div
													className={cn(
														"mt-1.5 h-2.5 w-2.5 rounded-full shadow-sm",
														getStatusColor(update.status).includes("emerald") &&
															"bg-emerald-500 shadow-emerald-500/20",
														getStatusColor(update.status).includes("blue") &&
															"bg-blue-500 shadow-blue-500/20",
														getStatusColor(update.status).includes("orange") &&
															"bg-orange-500 shadow-orange-500/20",
														getStatusColor(update.status).includes("gray") &&
															"bg-zinc-500 shadow-zinc-500/20",
													)}
												/>
											</TableCell>
											<TableCell className="py-4 align-top">
												<div className="space-y-1.5">
													<div className="prose prose-sm prose-neutral dark:prose-invert max-w-none text-foreground">
														<p className="whitespace-pre-wrap leading-relaxed">
															{update.message}
														</p>
													</div>
													<div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
														<span
															className={cn(
																getStatusColor(update.status).includes(
																	"emerald",
																) && "text-emerald-500",
																getStatusColor(update.status).includes(
																	"blue",
																) && "text-blue-500",
																getStatusColor(update.status).includes(
																	"orange",
																) && "text-orange-500",
																getStatusColor(update.status).includes(
																	"gray",
																) && "text-zinc-500",
															)}
														>
															{update.status === "completed"
																? "Completed"
																: update.status === "in_progress"
																	? "In Progress"
																	: "Scheduled"}
														</span>
														<span>·</span>
														<span>
															{formatDistanceToNow(new Date(update.createdAt), {
																addSuffix: true,
															})}
														</span>
													</div>
												</div>
											</TableCell>
											<TableCell className="w-[50px] py-4 pr-4 text-right align-top">
												<UpdateActions
													update={update}
													onEdit={() => setEditingUpdate(update)}
												/>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				</div>

				{/* Sidebar: Metadata */}
				<div className="space-y-6 lg:col-span-1">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
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
						<CardContent className="space-y-4">
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

					{maintenance.monitors.length > 0 && (
						<Card>
							<CardContent className="pt-6">
								<h3 className="mb-1 font-medium text-muted-foreground text-sm">
									Affected Services
								</h3>
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

			<PostUpdateDialog
				open={postOpen}
				onOpenChange={setPostOpen}
				maintenanceId={maintenanceId}
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

function PostUpdateDialog({
	open,
	onOpenChange,
	maintenanceId,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	maintenanceId: string;
}) {
	const queryClient = useQueryClient();
	const form = useForm<UpdateFormValues>({
		resolver: zodResolver(updateSchema),
		defaultValues: {
			message: "",
			status: "in_progress",
		},
	});

	const { mutate: createUpdate, isPending } = useMutation({
		mutationFn: (values: UpdateFormValues) =>
			client.maintenance.createUpdate({
				maintenanceId,
				...values,
			}),
		onSuccess: () => {
			toast.success("Update posted successfully");
			queryClient.invalidateQueries({
				queryKey: orpc.maintenance.get.key({ input: { maintenanceId } }),
			});
			form.reset();
			onOpenChange(false);
		},
		onError: (err) => {
			toast.error("Failed to post update: " + err.message);
		},
	});

	function onSubmit(values: UpdateFormValues) {
		createUpdate(values);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Post an update</DialogTitle>
					<DialogDescription>
						Keep your users informed about the current status.
					</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="message"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Message</FormLabel>
									<FormControl>
										<Textarea
											placeholder="What's the latest status?"
											className="min-h-[100px] resize-y"
											{...field}
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
											<SelectItem value="in_progress">In Progress</SelectItem>
											<SelectItem value="completed">Completed</SelectItem>
										</SelectContent>
									</Select>
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
								{isPending ? "Posting..." : "Post update"}
							</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}

function UpdateActions({
	update,
	onEdit,
}: {
	update: { id: string; message: string; status: string };
	onEdit: () => void;
}) {
	const [open, setOpen] = useState(false);
	const queryClient = useQueryClient();
	const { mutate: deleteUpdate, isPending } = useMutation({
		mutationFn: async () => {
			await client.maintenance.deleteUpdate({ updateId: update.id });
		},
		onSuccess: () => {
			toast.success("Update deleted");
			queryClient.invalidateQueries({
				queryKey: orpc.maintenance.get.key(),
			});
			setOpen(false);
		},
		onError: () => {
			toast.error("Failed to delete update");
		},
	});

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
					>
						<MoreHorizontal className="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onClick={onEdit}>
						<Pencil className="mr-2 h-4 w-4" />
						Edit
					</DropdownMenuItem>
					<DropdownMenuItem
						className="text-red-600 focus:text-red-600"
						onClick={() => setOpen(true)}
					>
						<Trash className="mr-2 h-4 w-4" />
						Remove
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<AlertDialog open={open} onOpenChange={setOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the
							maintenance update.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={(e) => {
								e.preventDefault();
								deleteUpdate();
							}}
							disabled={isPending}
							className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
						>
							{isPending ? "Deleting..." : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
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

	const onSubmit = (values: { message: string; status: string }) => {
		updateUpdate(values);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Edit maintenance update</DialogTitle>
					<DialogDescription>
						Update the message for this status update.
					</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
											<SelectItem value="in_progress">In Progress</SelectItem>
											<SelectItem value="completed">Completed</SelectItem>
										</SelectContent>
									</Select>
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
			</DialogContent>
		</Dialog>
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
			</DialogContent>
		</Dialog>
	);
}
