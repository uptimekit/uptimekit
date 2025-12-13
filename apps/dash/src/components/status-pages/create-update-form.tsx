"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
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
import { client, orpc } from "@/utils/orpc";

const formSchema = z.object({
	title: z.string().min(1, "Title is required"),
	status: z.enum(["investigating", "identified", "monitoring", "resolved"]),
	severity: z.enum(["minor", "major", "critical", "maintenance"]),
	message: z.string().min(1, "Message is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateStatusUpdateFormProps {
	statusPageId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

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
		},
	});

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
			<DialogContent className="sm:max-w-[525px]">
				<DialogHeader>
					<DialogTitle>Post Status Update</DialogTitle>
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
												<SelectItem value="identified">Identified</SelectItem>
												<SelectItem value="monitoring">Monitoring</SelectItem>
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
												<SelectItem value="maintenance">Maintenance</SelectItem>
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
									<FormLabel>MessageBody</FormLabel>
									<FormControl>
										<Textarea
											placeholder="We are currently investigating..."
											className="min-h-[100px]"
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
