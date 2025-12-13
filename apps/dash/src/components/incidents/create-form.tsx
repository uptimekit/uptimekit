"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { toast } from "sonner";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, X } from "lucide-react";

const schema = z.object({
	title: z.string().min(1, "Title is required"),
	description: z.string().optional(),
	severity: z.enum(["minor", "major", "critical"]),
	monitorIds: z.array(z.string()).default([]),
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

	const { data: monitors } = useQuery(orpc.monitors.list.queryOptions());

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
		<Card>
			<CardHeader>
				<CardTitle>Create Incident</CardTitle>
				<CardDescription>
					Manually report a new incident. You can link multiple monitors to it.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => router.back()}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={createIncident.isPending}>
								Create Incident
							</Button>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
}
