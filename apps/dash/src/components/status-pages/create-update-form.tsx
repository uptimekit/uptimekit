"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
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
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { client, orpc } from "@/utils/orpc";

const formSchema = z.object({
	title: z.string().min(1, "Title is required"),
	status: z.enum(["investigating", "identified", "monitoring", "resolved"]),
	severity: z.enum(["minor", "major", "critical", "maintenance"]),
	message: z.string().min(1, "Message is required"),
	monitors: z
		.array(
			z.object({
				id: z.string(),
				status: z.string(),
			}),
		)
		.default([]),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateStatusUpdateFormProps {
	statusPageId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
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

	const { data: monitors } = useQuery(orpc.monitors.list.queryOptions());

	const { mutate, isPending } = useMutation({
		mutationFn: (data: FormValues) =>
			client.statusUpdates.create({
				...data,
				statusPageId,
			}),
		onSuccess: () => {
			toast.success("Status update posted successfully");
			queryClient.invalidateQueries({
				queryKey: orpc.statusUpdates.list.key(),
			});
			onOpenChange(false);
			form.reset();
		},
		onError: (error: Error) => {
			toast.error(`Failed to post status update: ${error.message}`);
		},
	});

	function onSubmit(values: FormValues) {
		mutate(values);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Post Status Update</DialogTitle>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
						{/* Basic Information Section */}
						<div className="space-y-4">
							<h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
								Basic information
							</h3>
							<div className="grid gap-4 p-4 border rounded-lg bg-card/50">
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

								<div className="grid grid-cols-2 gap-4">
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
														<SelectTrigger>
															<SelectValue placeholder="Select status" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="investigating">
															Investigating
														</SelectItem>
														<SelectItem value="identified">
															Identified
														</SelectItem>
														<SelectItem value="monitoring">
															Monitoring
														</SelectItem>
														<SelectItem value="resolved">Resolved</SelectItem>
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
													defaultValue={field.value}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select severity" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="minor">Minor</SelectItem>
														<SelectItem value="major">Major</SelectItem>
														<SelectItem value="critical">Critical</SelectItem>
														<SelectItem value="maintenance">
															Maintenance
														</SelectItem>
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
								<h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
									Affected services
								</h3>
								<Popover>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											size="sm"
											role="combobox"
											className="h-8 border-dashed"
										>
											<ExternalLink className="mr-2 h-4 w-4" />
											Select specific services
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-[300px] p-0" align="end">
										<Command>
											<CommandInput placeholder="Search monitors..." />
											<CommandList>
												<CommandEmpty>No monitors found.</CommandEmpty>
												<CommandGroup>
													{monitors?.map((monitor) => {
														const isSelected = form
															.watch("monitors")
															.some((m) => m.id === monitor.id);
														return (
															<CommandItem
																value={monitor.name}
																key={monitor.id}
																onSelect={() => {
																	const current = form.getValues("monitors");
																	if (isSelected) {
																		form.setValue(
																			"monitors",
																			current.filter(
																				(m) => m.id !== monitor.id,
																			),
																		);
																	} else {
																		form.setValue("monitors", [
																			...current,
																			{
																				id: monitor.id,
																				status: "degraded", // Default to degraded
																			},
																		]);
																	}
																}}
															>
																<Check
																	className={cn(
																		"mr-2 h-4 w-4",
																		isSelected ? "opacity-100" : "opacity-0",
																	)}
																/>
																{monitor.name}
															</CommandItem>
														);
													})}
												</CommandGroup>
											</CommandList>
										</Command>
									</PopoverContent>
								</Popover>
							</div>

							<div className="border rounded-lg bg-card/50 divide-y">
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
														value={selectedMonitor.status}
														onValueChange={(val) => {
															const current = form.getValues("monitors");
															current[index].status = val;
															form.setValue("monitors", [...current]);
														}}
													>
														<SelectTrigger className="w-[140px] h-8 text-xs">
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
																			className={`w-2 h-2 rounded-full bg-current ${status.color.replace("text-", "bg-")}`}
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
