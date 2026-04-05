"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

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
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	ComboboxPopup,
	ComboboxValue,
} from "@/components/ui/combobox";
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
import { Textarea } from "@/components/ui/textarea";
import { client, orpc } from "@/utils/orpc";

const formSchema = z.object({
	status: z.enum(["investigating", "identified", "monitoring", "resolved"]),
	message: z.string().min(1, "Message is required"),
	monitors: z.array(
		z.object({
			id: z.string(),
			status: z.string(),
		}),
	),
});

type FormValues = z.infer<typeof formSchema>;

interface EditUpdateFormProps {
	statusPageId: string;
	updateId: string;
	reportId: string; // Needed for invalidation
	initialValues: {
		status: string;
		message: string;
		monitors: { id: string; status: string }[];
	};
	onSuccess?: () => void;
	onCancel?: () => void;
}

interface Monitor {
	id: string;
	name: string;
}

const MONITOR_STATUSES = [
	{ label: "Degraded", value: "degraded", color: "text-yellow-500" },
	{ label: "Downtime", value: "down", color: "text-red-500" },
	{ label: "Resolved", value: "resolved", color: "text-green-500" },
	{ label: "Not affected", value: "up", color: "text-gray-500" },
] as const;

export function EditUpdateForm({
	statusPageId,
	updateId,
	reportId,
	initialValues,
	onSuccess,
	onCancel,
}: EditUpdateFormProps) {
	const queryClient = useQueryClient();
	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			status: initialValues.status as
				| "investigating"
				| "identified"
				| "monitoring"
				| "resolved",
			message: initialValues.message,
			monitors: initialValues.monitors,
		},
	});

	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	const { data: monitorsData } = useQuery(
		orpc.monitors.list.queryOptions({ limit: 100 }),
	);
	const monitors = monitorsData?.items ?? [];

	const { mutate, isPending } = useMutation({
		mutationFn: (data: FormValues) =>
			client.statusUpdates.editUpdate({
				...data,
				statusPageId,
				updateId,
			}),
		onSuccess: () => {
			toast.success("Update edited successfully");
			queryClient.invalidateQueries({
				queryKey: orpc.statusUpdates.get.key({
					input: { statusPageId, reportId },
				}),
			});
			onSuccess?.();
		},
		onError: (error: Error) => {
			toast.error(`Failed to edit update: ${error.message}`);
		},
	});

	const { mutate: deleteUpdate, isPending: isDeleting } = useMutation({
		mutationFn: () =>
			client.statusUpdates.deleteUpdate({
				statusPageId,
				updateId,
			}),
		onSuccess: () => {
			toast.success("Update deleted successfully");
			queryClient.invalidateQueries({
				queryKey: orpc.statusUpdates.get.key({
					input: { statusPageId, reportId },
				}),
			});
			onSuccess?.();
		},
		onError: (error: Error) => {
			toast.error(`Failed to delete update: ${error.message}`);
		},
	});

	function onSubmit(values: FormValues) {
		mutate(values);
	}

	const selectedMonitors = monitors.filter((m) =>
		form.watch("monitors").some((sm) => sm.id === m.id),
	);

	const handleMonitorChange = (newValue: Monitor[]) => {
		const currentMonitors = form.getValues("monitors");
		const newMonitors = newValue.map((m) => {
			const existing = currentMonitors.find((cm) => cm.id === m.id);
			return {
				id: m.id,
				status: existing?.status || "degraded",
			};
		});
		form.setValue("monitors", newMonitors);
	};

	return (
		<>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
					<div className="space-y-4">
						<FormField
							control={form.control}
							name="message"
							render={({ field }) => (
								<FormItem>
									<div className="flex items-center justify-between">
										<FormLabel>Message</FormLabel>
										<span className="text-muted-foreground text-xs">
											Markdown supported
										</span>
									</div>
									<FormControl>
										<Textarea
											placeholder="Describe the update..."
											className="min-h-[120px] resize-y"
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
												<SelectValue placeholder="Select status" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value="investigating">
												Investigating
											</SelectItem>
											<SelectItem value="identified">Identified</SelectItem>
											<SelectItem value="monitoring">Monitoring</SelectItem>
											<SelectItem value="resolved">Resolved</SelectItem>
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<h3 className="font-medium text-foreground text-sm">
								Affected Services
							</h3>
						</div>

						<FormField
							control={form.control}
							name="monitors"
							render={() => (
								<FormItem>
									<FormControl>
										<Combobox
											items={monitors}
											value={selectedMonitors}
											onValueChange={handleMonitorChange}
											multiple
										>
											<ComboboxChips>
												<ComboboxValue>
													{(value: Monitor[]) => (
														<>
															{value?.map((item) => (
																<ComboboxChip
																	key={item.id}
																	aria-label={item.name}
																>
																	{item.name}
																</ComboboxChip>
															))}
															<ComboboxChipsInput
																aria-label="Select monitors"
																placeholder={
																	value?.length > 0
																		? undefined
																		: "Modify services..."
																}
																className="h-8 border-dashed"
															/>
														</>
													)}
												</ComboboxValue>
											</ComboboxChips>
											<ComboboxPopup>
												<ComboboxEmpty>No monitors found.</ComboboxEmpty>
												<ComboboxList>
													{(item: Monitor) => (
														<ComboboxItem key={item.id} value={item}>
															{item.name}
														</ComboboxItem>
													)}
												</ComboboxList>
											</ComboboxPopup>
										</Combobox>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{form.watch("monitors").length > 0 && (
							<div className="divide-y rounded-md border">
								{form.watch("monitors").map((selectedMonitor, index) => {
									const monitor = monitors?.find(
										(m) => m.id === selectedMonitor.id,
									);
									if (!monitor) return null;

									return (
										<div
											key={monitor.id}
											className="flex items-center justify-between p-3"
										>
											<div className="flex items-center gap-3">
												<div className="font-medium text-sm">
													{monitor.name}
												</div>
											</div>
											<div className="flex items-center gap-2">
												<Select
													value={selectedMonitor.status || "degraded"}
													onValueChange={(val) => {
														const current = form.getValues("monitors");
														current[index].status = val || "degraded";
														form.setValue("monitors", [...current]);
													}}
												>
													<SelectTrigger className="h-7 w-[130px] text-xs">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{MONITOR_STATUSES.map((status) => (
															<SelectItem
																key={status.value}
																value={status.value}
															>
																<div className="flex items-center gap-2">
																	<div
																		className={`h-2 w-2 rounded-full bg-current ${status.color.replace("text-", "bg-")}`}
																	/>
																	{status.label}
																</div>
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<Button
													variant="ghost"
													size="icon"
													className="h-7 w-7 text-muted-foreground hover:text-foreground"
													onClick={() => {
														const current = form.getValues("monitors");
														form.setValue(
															"monitors",
															current.filter(
																(m) => m.id !== selectedMonitor.id,
															),
														);
													}}
												>
													<X className="h-3.5 w-3.5" />
												</Button>
											</div>
										</div>
									);
								})}
							</div>
						)}
						{form.watch("monitors").length === 0 && (
							<p className="text-muted-foreground text-sm italic">
								No services affected by this update.
							</p>
						)}
					</div>

					<div className="flex justify-between gap-2">
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
								variant="outline"
								onClick={onCancel}
								disabled={isPending || isDeleting}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isPending || isDeleting}>
								{isPending ? "Saving..." : "Save Changes"}
							</Button>
						</div>
					</div>
				</form>
			</Form>

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
