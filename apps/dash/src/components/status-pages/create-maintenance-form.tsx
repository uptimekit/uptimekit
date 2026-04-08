"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useForm } from "react-hook-form";
import { sileo } from "sileo";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
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
import { DateTimePicker } from "@/components/ui/date-time-picker";

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
	description: z.string().min(1, "Description is required"),
	status: z.enum(["scheduled", "in_progress", "completed"]),
	startAt: z.date(),
	endAt: z.date(),
	monitorIds: z.array(z.string()),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateMaintenanceFormProps {
	statusPageId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

interface Monitor {
	id: string;
	name: string;
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
			startAt: new Date(),
			endAt: new Date(Date.now() + 60 * 60 * 1000),
		},
	});

	const { data: monitorsData } = useQuery(
		orpc.monitors.list.queryOptions({ limit: 100 }),
	);
	const monitors = monitorsData?.items ?? [];

	const { mutate, isPending } = useMutation({
		mutationFn: (data: FormValues) =>
			client.maintenance.create({
				...data,
				statusPageId,
				startAt: data.startAt.toISOString(),
				endAt: data.endAt.toISOString(),
			}),
		onSuccess: () => {
			sileo.success({ title: "Maintenance scheduled successfully" });
			queryClient.invalidateQueries({ queryKey: orpc.maintenance.list.key() });
			onOpenChange(false);
			form.reset();
		},
		onError: (error: Error) => {
			sileo.error({
				title: `Failed to schedule maintenance: ${error.message}`,
			});
		},
	});

	function onSubmit(values: FormValues) {
		mutate(values);
	}

	const selectedMonitors = monitors.filter((m) =>
		form.watch("monitorIds")?.includes(m.id),
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[525px]">
				<DialogHeader>
					<DialogTitle>Schedule Maintenance</DialogTitle>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="contents">
						<DialogPanel className="space-y-4">
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
										<FormControl>
											<Combobox
												items={monitors}
												value={selectedMonitors}
												onValueChange={(newValue) =>
													field.onChange(newValue.map((i: Monitor) => i.id))
												}
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
																			: "Select monitors"
																	}
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
										<div className="mt-2 flex flex-wrap gap-2">
											{field.value?.map((id) => {
												const monitor = monitors?.find((m) => m.id === id);
												if (!monitor) return null;
												return (
													<Badge key={id} variant="secondary" className="gap-1">
														{monitor.name}
														<button
															type="button"
															className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
						</DialogPanel>

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
