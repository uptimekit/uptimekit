"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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

interface AddUpdateFormProps {
	statusPageId: string;
	reportId: string;
	currentStatus: string;
	initialMonitors: { id: string; status: string }[];
	onSuccess?: () => void;
}

const MONITOR_STATUSES = [
	{ label: "Degraded", value: "degraded", color: "text-yellow-500" },
	{ label: "Downtime", value: "down", color: "text-red-500" },
	{ label: "Resolved", value: "resolved", color: "text-green-500" },
	{ label: "Not affected", value: "up", color: "text-gray-500" },
] as const;

export function AddUpdateForm({
	statusPageId,
	reportId,
	currentStatus,
	initialMonitors,
	onSuccess,
}: AddUpdateFormProps) {
	const queryClient = useQueryClient();
	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			status: currentStatus as
				| "investigating"
				| "identified"
				| "monitoring"
				| "resolved",
			message: "",
			monitors: initialMonitors,
		},
	});

	const { data: monitorsData } = useQuery(
		orpc.monitors.list.queryOptions({ limit: 100 }),
	);
	const monitors = monitorsData?.items;

	const { mutate, isPending } = useMutation({
		mutationFn: (data: FormValues) =>
			client.statusUpdates.addUpdate({
				...data,
				statusPageId,
				reportId,
			}),
		onSuccess: () => {
			toast.success("Update posted successfully");
			queryClient.invalidateQueries({
				queryKey: orpc.statusUpdates.get.key({
					input: { statusPageId, reportId },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.statusUpdates.list.key(),
			});
			form.reset({
				status: form.getValues("status"), // Keep the new status
				message: "", // Clear message
				monitors: form.getValues("monitors"), // Keep monitors
			});
			onSuccess?.();
		},
		onError: (error: Error) => {
			toast.error(`Failed to post update: ${error.message}`);
		},
	});

	function onSubmit(values: FormValues) {
		mutate(values);
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<h3 className="font-medium text-lg">Post Update</h3>
					</div>
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
										placeholder="Describe the latest development..."
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
										<SelectItem value="investigating">Investigating</SelectItem>
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
						<Popover>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									role="combobox"
									className="h-8 border-dashed"
								>
									<ExternalLink className="mr-2 h-4 w-4" />
									Modify services
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
																	current.filter((m) => m.id !== monitor.id),
																);
															} else {
																form.setValue("monitors", [
																	...current,
																	{
																		id: monitor.id,
																		status: "degraded",
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
											<div className="font-medium text-sm">{monitor.name}</div>
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
												<SelectTrigger className="h-7 w-[130px] text-xs">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{MONITOR_STATUSES.map((status) => (
														<SelectItem key={status.value} value={status.value}>
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
														current.filter((m) => m.id !== selectedMonitor.id),
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

				<div className="flex justify-start">
					<Button type="submit" disabled={isPending}>
						{isPending ? "Posting..." : "Post Update"}
					</Button>
				</div>
			</form>
		</Form>
	);
}
