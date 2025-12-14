"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

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
import { DateTimePicker } from "@/components/ui/date-time-picker";
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
	title: z.string().min(1, "Title is required"),
	description: z.string().min(1, "Description is required"),
	status: z.enum(["scheduled", "in_progress", "completed"]),
	startAt: z.date({ required_error: "Start time is required" }),
	endAt: z.date({ required_error: "End time is required" }),
	monitorIds: z.array(z.string()).default([]),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateMaintenanceFormProps {
	statusPageId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CreateMaintenanceForm({
	statusPageId,
	open,
	onOpenChange,
}: CreateMaintenanceFormProps) {
	const queryClient = useQueryClient();
	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			title: "",
			description: "",
			status: "scheduled",
			monitorIds: [],
		},
	});

	const { data: monitors } = useQuery(orpc.monitors.list.queryOptions());

	const { mutate, isPending } = useMutation({
		mutationFn: (data: FormValues) =>
			client.maintenance.create({
				...data,
				statusPageId,
				startAt: data.startAt.toISOString(),
				endAt: data.endAt.toISOString(),
			}),
		onSuccess: () => {
			toast.success("Maintenance scheduled successfully");
			queryClient.invalidateQueries({ queryKey: orpc.maintenance.list.key() });
			onOpenChange(false);
			form.reset();
		},
		onError: (error: Error) => {
			toast.error(`Failed to schedule maintenance: ${error.message}`);
		},
	});

	function onSubmit(values: FormValues) {
		mutate(values);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[525px]">
				<DialogHeader>
					<DialogTitle>Schedule Maintenance</DialogTitle>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="title"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Title</FormLabel>
									<FormControl>
										<Input placeholder="Database Upgrade" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Description</FormLabel>
									<FormControl>
										<Textarea
											placeholder="We will be upgrading our database..."
											className="min-h-[100px]"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="monitorIds"
							render={({ field }) => (
								<FormItem className="flex flex-col">
									<FormLabel>Affected Monitors</FormLabel>
									<Popover>
										<PopoverTrigger asChild>
											<FormControl>
												<Button
													variant="outline"
													role="combobox"
													className={cn(
														"w-full justify-between",
														!field.value?.length && "text-muted-foreground",
													)}
												>
													{field.value?.length > 0
														? `${field.value.length} monitors selected`
														: "Select monitors"}
													<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
												</Button>
											</FormControl>
										</PopoverTrigger>
										<PopoverContent className="w-[400px] p-0">
											<Command>
												<CommandInput placeholder="Search monitors..." />
												<CommandList>
													<CommandEmpty>No monitors found.</CommandEmpty>
													<CommandGroup>
														{monitors?.map((monitor) => (
															<CommandItem
																value={monitor.name}
																key={monitor.id}
																onSelect={() => {
																	const current = field.value || [];
																	const isSelected = current.includes(
																		monitor.id,
																	);
																	if (isSelected) {
																		field.onChange(
																			current.filter((id) => id !== monitor.id),
																		);
																	} else {
																		field.onChange([...current, monitor.id]);
																	}
																}}
															>
																<Check
																	className={cn(
																		"mr-2 h-4 w-4",
																		field.value?.includes(monitor.id)
																			? "opacity-100"
																			: "opacity-0",
																	)}
																/>
																{monitor.name}
															</CommandItem>
														))}
													</CommandGroup>
												</CommandList>
											</Command>
										</PopoverContent>
									</Popover>
									<div className="flex flex-wrap gap-2 mt-2">
										{field.value?.map((id) => {
											const monitor = monitors?.find((m) => m.id === id);
											if (!monitor) return null;
											return (
												<Badge key={id} variant="secondary" className="gap-1">
													{monitor.name}
													<button
														type="button"
														className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
														onClick={() => {
															field.onChange(
																field.value.filter((val) => val !== id),
															);
														}}
													>
														<X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
													</button>
												</Badge>
											);
										})}
									</div>
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
											<SelectTrigger>
												<SelectValue placeholder="Select status" />
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
						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="startAt"
								render={({ field }) => (
									<FormItem className="flex flex-col">
										<FormLabel>Start Time</FormLabel>
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
										<FormLabel>End Time</FormLabel>
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
						</div>

						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isPending}>
								{isPending ? "Scheduling..." : "Schedule Maintenance"}
							</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
