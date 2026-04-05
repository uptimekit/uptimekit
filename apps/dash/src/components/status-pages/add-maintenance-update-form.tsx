"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Button } from "@/components/ui/button";
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
	status: z.enum(["scheduled", "in_progress", "completed"]),
	message: z.string().min(1, "Message is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface AddMaintenanceUpdateFormProps {
	maintenanceId: string;
	currentStatus: string;
	onSuccess?: () => void;
}

/**
 * Renders a form for posting updates to a maintenance record.
 *
 * The form validates input, posts the update to the server, refreshes the maintenance data on success,
 * resets the message while preserving the selected status, and shows success or error toasts.
 *
 * @param maintenanceId - The ID of the maintenance record to which the update will be posted
 * @param currentStatus - The initial status value selected in the form ("scheduled", "in_progress", or "completed")
 * @param onSuccess - Optional callback invoked after a successful post
 * @returns The rendered form component for creating a maintenance update
 */
export function AddMaintenanceUpdateForm({
	maintenanceId,
	currentStatus,
	onSuccess,
}: AddMaintenanceUpdateFormProps) {
	const queryClient = useQueryClient();
	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			status: currentStatus as "scheduled" | "in_progress" | "completed",
			message: "",
		},
	});

	const { mutate, isPending } = useMutation({
		mutationFn: (data: FormValues) =>
			client.maintenance.createUpdate({
				maintenanceId,
				...data,
			}),
		onSuccess: () => {
			toast.success("Update posted successfully");
			queryClient.invalidateQueries({
				queryKey: orpc.maintenance.get.key({
					input: { maintenanceId },
				}),
			});
			form.reset({
				status: form.getValues("status"), // Keep the new status
				message: "", // Clear message
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
										<SelectItem value="scheduled">Scheduled</SelectItem>
										<SelectItem value="in_progress">In Progress</SelectItem>
										<SelectItem value="completed">Completed</SelectItem>
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>
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
