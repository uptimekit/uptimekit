"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { client, orpc } from "@/utils/orpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	ArrowLeft,
	Calendar,
	CheckCircle,
	Clock,
	Megaphone,
	Wrench,
} from "lucide-react";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";

const updateSchema = z.object({
	message: z.string().min(1, "Message is required"),
	status: z.enum(["scheduled", "in_progress", "completed"]),
});

type UpdateFormValues = z.infer<typeof updateSchema>;

export default function MaintenanceDetailsPage() {
	const params = useParams();
	const router = useRouter();
	const maintenanceId = params.maintenanceId as string;
	const queryClient = useQueryClient();

	const { data: maintenance, isLoading } = useQuery(
		orpc.maintenance.get.queryOptions({
			input: { maintenanceId },
		}),
	);

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
			form.reset({
				message: "",
				status: form.getValues("status"), // Keep previous status or default?
			});
		},
		onError: (err) => {
			toast.error("Failed to post update: " + err.message);
		},
	});

	if (isLoading) {
		return (
			<div className="py-8 text-center text-muted-foreground">Loading...</div>
		);
	}

	if (!maintenance) {
		return <div>Maintenance not found</div>;
	}

	function onSubmit(values: UpdateFormValues) {
		createUpdate(values);
	}

	function getStatusColor(status: string) {
		switch (status) {
			case "in_progress":
				return "bg-blue-500/10 text-blue-500 border-blue-500/20";
			case "completed":
				return "bg-green-500/10 text-green-500 border-green-500/20";
			case "scheduled":
				return "bg-orange-500/10 text-orange-500 border-orange-500/20";
			default:
				return "bg-gray-500/10 text-gray-500 border-gray-500/20";
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
									"flex items-center gap-1.5 px-2.5 py-0.5 text-sm font-medium capitalize shadow-none transition-colors",
									getStatusColor(maintenance.status),
								)}
							>
								{getStatusIcon(maintenance.status)}
								{maintenance.status.replace("_", " ")}
							</Badge>
							<span className="text-sm text-muted-foreground">
								{format(new Date(maintenance.startAt), "MMM d, yyyy")}
							</span>
						</div>
						<h1 className="text-3xl font-bold tracking-tight md:text-4xl">
							{maintenance.title}
						</h1>
					</div>
				</div>
			</div>

			<div className="grid gap-8 lg:grid-cols-3">
				{/* Main Content: Updates & Timeline */}
				<div className="space-y-8 lg:col-span-2">
					<div className="flex items-center justify-between">
						<h2 className="text-xl font-semibold tracking-tight">Timeline</h2>
					</div>

					{/* Post Update Form */}
					{maintenance.status !== "completed" && (
						<Card className="border-muted bg-muted/30 shadow-none overflow-hidden">
							<CardHeader className="bg-muted/50 pb-4">
								<CardTitle className="flex items-center gap-2 text-base font-medium">
									<Megaphone className="h-4 w-4 text-primary" />
									Post an update
								</CardTitle>
							</CardHeader>
							<CardContent className="pt-6">
								<Form {...form}>
									<form
										onSubmit={form.handleSubmit(onSubmit)}
										className="space-y-4"
									>
										<FormField
											control={form.control}
											name="message"
											render={({ field }) => (
												<FormItem>
													<FormControl>
														<Textarea
															placeholder="What's the latest status?"
															className="min-h-[100px] resize-y bg-background"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<div className="flex items-center justify-between gap-4">
											<FormField
												control={form.control}
												name="status"
												render={({ field }) => (
													<FormItem className="flex-1">
														<Select
															onValueChange={field.onChange}
															defaultValue={field.value}
														>
															<FormControl>
																<SelectTrigger className="bg-background">
																	<SelectValue placeholder="Status" />
																</SelectTrigger>
															</FormControl>
															<SelectContent>
																<SelectItem value="scheduled">
																	Scheduled
																</SelectItem>
																<SelectItem value="in_progress">
																	In Progress
																</SelectItem>
																<SelectItem value="completed">
																	Completed
																</SelectItem>
															</SelectContent>
														</Select>
														<FormMessage />
													</FormItem>
												)}
											/>
											<Button
												type="submit"
												disabled={isPending}
												className="min-w-[120px]"
											>
												{isPending ? "Posting..." : "Post update"}
											</Button>
										</div>
									</form>
								</Form>
							</CardContent>
						</Card>
					)}

					<div className="space-y-0">
						{/* Updates Timeline */}
						{maintenance.updates?.map((update) => (
							<div key={update.id} className="relative pb-12 pl-12">
								{/* Vertical connecting line */}
								<div
									className="absolute bottom-0 left-4 top-8 -ml-px w-[2px] bg-border/50"
									style={{ transform: "translateX(-0.5px)" }}
								/>

								{/* Icon */}
								<div
									className={cn(
										"absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border bg-background shadow-sm ring-4 ring-background transition-all",
										getStatusColor(update.status),
									)}
								>
									{getStatusIcon(update.status)}
								</div>

								{/* Content */}
								<div className="space-y-2 pt-1">
									<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
										<h4 className="text-base font-medium leading-none">
											{update.status === "completed"
												? "Maintenance Completed"
												: update.status === "in_progress"
													? "Update Posted"
													: "Status Update"}
										</h4>
										<span className="text-xs text-muted-foreground/70">
											{format(
												new Date(update.createdAt),
												"MMM d, yyyy 'at' h:mma",
											)}
										</span>
									</div>
									<div className="prose prose-sm prose-neutral max-w-none text-muted-foreground dark:prose-invert">
										<p className="whitespace-pre-wrap leading-relaxed">
											{update.message}
										</p>
									</div>
								</div>
							</div>
						))}

						{/* Creation Event */}
						<div className="relative pl-12">
							{/* No connecting line for the last item */}

							{/* Icon - Dashed for creation to differentiate/style as needed */}
							<div className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border bg-background shadow-sm ring-4 ring-background">
								<div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
							</div>

							{/* Content */}
							<div className="space-y-2 pt-1">
								<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
									<h4 className="text-base font-medium leading-none">
										Maintenance Scheduled
									</h4>
									<span className="text-xs text-muted-foreground/70">
										{format(
											new Date(maintenance.createdAt),
											"MMM d, yyyy 'at' h:mma",
										)}
									</span>
								</div>
								<div className="prose prose-sm prose-neutral max-w-none text-muted-foreground dark:prose-invert">
									<p className="whitespace-pre-wrap leading-relaxed">
										{maintenance.description || "No description provided."}
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Sidebar: Metadata */}
				<div className="space-y-6 lg:col-span-1">
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								Window
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-start gap-3">
								<Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
								<div className="space-y-0.5">
									<span className="text-xs font-medium text-muted-foreground uppercase">
										Start
									</span>
									<p className="text-sm font-medium">
										{format(new Date(maintenance.startAt), "MMM d, yyyy")}
									</p>
									<p className="text-xs text-muted-foreground">
										{format(new Date(maintenance.startAt), "h:mm a")}
									</p>
								</div>
							</div>
							<Separator />
							<div className="flex items-start gap-3">
								<Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
								<div className="space-y-0.5">
									<span className="text-xs font-medium text-muted-foreground uppercase">
										End
									</span>
									<p className="text-sm font-medium">
										{format(new Date(maintenance.endAt), "MMM d, yyyy")}
									</p>
									<p className="text-xs text-muted-foreground">
										{format(new Date(maintenance.endAt), "h:mm a")}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{maintenance.monitors.length > 0 && (
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									Affected Services
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="flex flex-wrap gap-2">
									{maintenance.monitors.map((m) => (
										<Badge
											key={m.monitor.id}
											variant="secondary"
											className="font-normal"
										>
											{m.monitor.name}
										</Badge>
									))}
								</div>
							</CardContent>
						</Card>
					)}
				</div>
			</div>
		</div>
	);
}
