"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

const schema = z.object({
	title: z.string().min(1, "Title is required"),
	description: z.string().optional(),
	severity: z.enum(["minor", "major", "critical"]),
	monitorIds: z.array(z.string()),
});

type FormValues = z.infer<typeof schema>;

export function CreateIncidentForm() {
	const router = useRouter();

	const form = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			title: "",
			description: "",
			severity: "major",
			monitorIds: [],
		},
	});

	const { data: monitorsData } = useQuery(
		orpc.monitors.list.queryOptions({ limit: 100 }),
	);
	const monitors = monitorsData?.items;

	const createIncident = useMutation(
		orpc.incidents.create.mutationOptions({
			onSuccess: (data) => {
				toast.success("Incident created successfully");
				router.push(`/incidents/${data.id}`);
			},
			onError: (err) => {
				toast.error("Failed to create incident: " + err.message);
			},
		}),
	);

	function onSubmit(values: FormValues) {
		createIncident.mutate(values);
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10 pb-20">
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
											defaultValue={field.value}
										>
											<FormControl>
												<SelectTrigger className="w-full">
													<SelectValue placeholder="Select severity" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="minor">Minor</SelectItem>
												<SelectItem value="major">Major</SelectItem>
												<SelectItem value="critical">Critical</SelectItem>
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
																				current.filter(
																					(id) => id !== monitor.id,
																				),
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
						</CardContent>
					</Card>
				</div>

				<div className="fixed right-0 bottom-0 left-0 z-0 flex justify-end gap-4 border-t bg-background/80 p-4 backdrop-blur-sm">
					<Button
						type="button"
						variant="outline"
						onClick={() => router.back()}
						disabled={createIncident.isPending}
					>
						Cancel
					</Button>
					<Button type="submit" disabled={createIncident.isPending}>
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
