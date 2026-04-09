"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { sileo } from "sileo";
import { z } from "zod";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GroupedMonitorCombobox } from "@/components/monitors/grouped-monitor-combobox";
import { DateTimePicker } from "@/components/ui/date-time-picker";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/utils/orpc";

const schema = z
	.object({
		title: z.string().min(1, "Title is required"),
		description: z.string().optional(),
		severity: z.enum(["minor", "major", "critical"]),
		monitorIds: z.array(z.string()),
		statusPageIds: z.array(z.string()),
		startedAt: z.date(),
		endedAt: z.date().nullable(),
	})
	.refine((value) => !value.endedAt || value.endedAt >= value.startedAt, {
		message: "End time cannot be before start time",
		path: ["endedAt"],
	});

type FormValues = z.infer<typeof schema>;

const severityOptions = [
	{ label: "Minor", value: "minor" },
	{ label: "Major", value: "major" },
	{ label: "Critical", value: "critical" },
] as const;

interface Monitor {
	id: string;
	name: string;
}

interface StatusPage {
	id: string;
	name: string;
}

export function CreateIncidentForm() {
	const router = useRouter();

	const form = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			title: "",
			description: "",
			severity: "major",
			monitorIds: [],
			statusPageIds: [],
			startedAt: new Date(),
			endedAt: null,
		},
	});

	const { data: monitorsData } = useQuery(
		orpc.monitors.list.queryOptions({ limit: 100 }),
	);
	const { data: statusPagesData } = useQuery(
		orpc.statusPages.list.queryOptions({ limit: 100 }),
	);
	const monitors = monitorsData?.items ?? [];
	const statusPages = statusPagesData?.items ?? [];

	const createIncident = useMutation(
		orpc.incidents.create.mutationOptions({
			onSuccess: (data) => {
				sileo.success({ title: "Incident created successfully" });
				router.push(`/incidents/${data.id}`);
			},
			onError: (err) => {
				sileo.error({ title: `Failed to create incident: ${err.message}` });
			},
		}),
	);

	const submitForm = (values: FormValues) => {
		createIncident.mutate(values);
	};

	const handleSave = () => {
		void form.handleSubmit(submitForm)();
	};

	const selectedMonitors = monitors.filter((m) =>
		form.watch("monitorIds")?.includes(m.id),
	);

	const selectedStatusPages = statusPages.filter((p) =>
		form.watch("statusPageIds")?.includes(p.id),
	);

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(submitForm)}
				className="space-y-10 pb-20"
			>
				<div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
					<div className="col-span-1">
						<h2 className="font-semibold text-lg leading-tight tracking-tight">
							Incident details
						</h2>
						<p className="mt-1 text-muted-foreground text-sm">
							Provide the basic information about the incident.
						</p>
					</div>

					<Card className="col-span-1 md:col-span-2">
						<CardContent className="space-y-6 p-6">
							<FormField
								control={form.control}
								name="title"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Title</FormLabel>
										<FormControl>
											<Input
												placeholder="e.g. Database Connectivity Issues"
												{...field}
											/>
										</FormControl>
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
												<SelectTrigger className="w-full">
													<SelectValue placeholder="Select severity">
														{severityOptions.find(
															(option) => option.value === field.value,
														)?.label}
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

							<FormField
								control={form.control}
								name="description"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Description</FormLabel>
										<FormControl>
											<Textarea
												placeholder="Describe the incident..."
												className="resize-none"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className="grid gap-6 md:grid-cols-2">
								<FormField
									control={form.control}
									name="startedAt"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Started at</FormLabel>
											<FormControl>
												<DateTimePicker
													date={field.value}
													setDate={(date) => field.onChange(date ?? new Date())}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="endedAt"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Ended at</FormLabel>
											<div className="space-y-2">
												<FormControl>
													<DateTimePicker
														date={field.value ?? undefined}
														setDate={(date) => field.onChange(date ?? null)}
													/>
												</FormControl>
												{field.value && (
													<Button
														type="button"
														variant="ghost"
														size="sm"
														className="px-0"
														onClick={() => field.onChange(null)}
													>
														Clear end time
													</Button>
												)}
											</div>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
						</CardContent>
					</Card>
				</div>

				<Separator />

				<div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
					<div className="col-span-1">
						<h2 className="font-semibold text-lg leading-tight tracking-tight">
							Impact
						</h2>
						<p className="mt-1 text-muted-foreground text-sm">
							Select the monitors affected by this incident.
						</p>
					</div>

					<Card className="col-span-1 md:col-span-2">
						<CardContent className="space-y-6 p-6">
							<FormField
								control={form.control}
								name="monitorIds"
								render={({ field }) => (
									<FormItem className="flex flex-col">
										<FormLabel>Affected Monitors</FormLabel>
										<FormControl>
											<GroupedMonitorCombobox
												ariaLabel="Select monitors"
												monitors={monitors}
												value={selectedMonitors}
												onValueChange={(newValue) =>
													field.onChange(newValue.map((item) => item.id))
												}
												placeholder="Select monitors"
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="statusPageIds"
								render={({ field }) => (
									<FormItem className="flex flex-col">
										<FormLabel>Publish to Status Pages</FormLabel>
										<FormControl>
											<Combobox
												items={statusPages}
												value={selectedStatusPages}
												onValueChange={(newValue) =>
													field.onChange(newValue.map((i: StatusPage) => i.id))
												}
												multiple
											>
												<ComboboxChips>
													<ComboboxValue>
														{(value: StatusPage[]) => (
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
																	aria-label="Select status pages"
																	placeholder={
																		value?.length > 0
																			? undefined
																			: "Keep internal only"
																	}
																/>
															</>
														)}
													</ComboboxValue>
												</ComboboxChips>
												<ComboboxPopup>
													<ComboboxEmpty>No status pages found.</ComboboxEmpty>
													<ComboboxList>
														{(item: StatusPage) => (
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
						</CardContent>
					</Card>
				</div>

				<div className="sticky bottom-0 z-10 flex justify-end gap-4 border-t bg-background/80 p-4 backdrop-blur-sm">
					<Button
						type="button"
						variant="outline"
						onClick={() => router.back()}
						disabled={createIncident.isPending}
					>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={handleSave}
						disabled={createIncident.isPending}
					>
						{createIncident.isPending && (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						)}
						Create Incident
					</Button>
				</div>
			</form>
		</Form>
	);
}
