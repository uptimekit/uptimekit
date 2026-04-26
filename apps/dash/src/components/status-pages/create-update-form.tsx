"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useForm } from "react-hook-form";
import { sileo } from "sileo";
import * as z from "zod";

import { GroupedMonitorCombobox } from "@/components/monitors/grouped-monitor-combobox";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
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
import { Input } from "@/components/ui/input";
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
	title: z.string().min(1, "Title is required"),
	status: z.enum(["investigating", "identified", "monitoring", "resolved"]),
	severity: z.enum(["minor", "major", "critical"]),
	message: z.string().min(1, "Message is required"),
	monitors: z.array(
		z.object({
			id: z.string(),
			status: z.string(),
		}),
	),
});

type FormValues = z.infer<typeof formSchema>;

const updateStatusOptions = [
	{ label: "Investigating", value: "investigating" },
	{ label: "Identified", value: "identified" },
	{ label: "Monitoring", value: "monitoring" },
	{ label: "Resolved", value: "resolved" },
] as const;

const severityOptions = [
	{ label: "Minor", value: "minor" },
	{ label: "Major", value: "major" },
	{ label: "Critical", value: "critical" },
] as const;

interface CreateStatusUpdateFormProps {
	statusPageId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

interface Monitor {
	id: string;
	name: string;
}

const MONITOR_STATUSES = [
	{ label: "Degraded", value: "degraded", color: "text-yellow-500" },
	{ label: "Downtime", value: "down", color: "text-red-500" },
	{ label: "Resolved", value: "resolved", color: "text-green-500" },
	{ label: "Not affected", value: "up", color: "text-gray-500" }, // 'up' or 'not_affected', using 'up' as standard
] as const;

export function CreateStatusUpdateForm({
	statusPageId,
	open,
	onOpenChange,
}: CreateStatusUpdateFormProps) {
	const queryClient = useQueryClient();
	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			title: "",
			status: "investigating",
			severity: "minor",
			message: "",
			monitors: [],
		},
	});

	const { data: monitorsData } = useQuery(
		orpc.monitors.list.queryOptions({ input: { limit: 100 } }),
	);
	const monitors = monitorsData?.items ?? [];

	const { mutate, isPending } = useMutation({
		mutationFn: (data: FormValues) =>
			client.statusUpdates.create({
				...data,
				statusPageId,
			}),
		onSuccess: () => {
			sileo.success({ title: "Status update posted successfully" });
			queryClient.invalidateQueries({
				queryKey: orpc.statusUpdates.list.key(),
			});
			onOpenChange(false);
			form.reset();
		},
		onError: (error: Error) => {
			sileo.error({ title: `Failed to post status update: ${error.message}` });
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
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
				<DialogHeader>
					<DialogTitle>Post Status Update</DialogTitle>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="contents">
						<DialogPanel className="space-y-8">
							{/* Basic Information Section */}
							<div className="space-y-4">
								<h3 className="font-medium text-muted-foreground text-sm tracking-wider">
									Basic information
								</h3>
								<div className="grid gap-4 rounded-lg border bg-card/50 p-4">
									<FormField
										control={form.control}
										name="title"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Title</FormLabel>
												<FormControl>
													<Input placeholder="Service Outage" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<div className="grid gap-4">
										<FormField
											control={form.control}
											name="status"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Status</FormLabel>
													<Select
														onValueChange={field.onChange}
														value={field.value}
													>
														<FormControl>
															<SelectTrigger>
																<SelectValue placeholder="Select status">
																	{
																		updateStatusOptions.find(
																			(option) => option.value === field.value,
																		)?.label
																	}
																</SelectValue>
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															{updateStatusOptions.map(({ label, value }) => (
																<SelectItem key={value} value={value}>
																	{label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="severity"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Severity</FormLabel>
													<Select
														onValueChange={field.onChange}
														value={field.value}
													>
														<FormControl>
															<SelectTrigger>
																<SelectValue placeholder="Select severity">
																	{
																		severityOptions.find(
																			(option) => option.value === field.value,
																		)?.label
																	}
																</SelectValue>
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															{severityOptions.map(({ label, value }) => (
																<SelectItem key={value} value={value}>
																	{label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>

									<FormField
										control={form.control}
										name="message"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Message</FormLabel>
												<FormControl>
													<Textarea
														placeholder="Describe the incident..."
														className="min-h-[100px]"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
							</div>

							{/* Affected Services Section */}
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<h3 className="font-medium text-muted-foreground text-sm tracking-wider">
										Affected services
									</h3>
								</div>

								<FormField
									control={form.control}
									name="monitors"
									render={() => (
										<FormItem>
											<FormControl>
												<GroupedMonitorCombobox
													ariaLabel="Select monitors"
													inputClassName="h-8 border-dashed"
													monitors={monitors}
													value={selectedMonitors}
													onValueChange={handleMonitorChange}
													placeholder="Select specific services..."
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<div className="divide-y rounded-lg border bg-card/50">
									{form.watch("monitors").length === 0 ? (
										<div className="p-8 text-center text-muted-foreground text-sm">
											No services selected. The incident will be global.
										</div>
									) : (
										form.watch("monitors").map((selectedMonitor, index) => {
											const monitor = monitors?.find(
												(m) => m.id === selectedMonitor.id,
											);
											if (!monitor) return null;

											return (
												<div
													key={monitor.id}
													className="flex items-center justify-between p-4"
												>
													<div className="font-medium text-sm">
														{monitor.name}
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
															<SelectTrigger className="h-8 w-[140px] text-xs">
																<SelectValue>
																	{
																		MONITOR_STATUSES.find(
																			(status) =>
																				status.value ===
																				(selectedMonitor.status || "degraded"),
																		)?.label
																	}
																</SelectValue>
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
															className="h-8 w-8 text-muted-foreground hover:text-foreground"
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
															<X className="h-4 w-4" />
														</Button>
													</div>
												</div>
											);
										})
									)}
								</div>
							</div>
						</DialogPanel>
						<div className="flex justify-end gap-2 pt-4">
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isPending}>
								{isPending ? "Posting..." : "Post Update"}
							</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
