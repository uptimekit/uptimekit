"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { client, orpc } from "@/utils/orpc";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

const formSchema = z.object({
	name: z.string().min(1, "Name is required"),
	slug: z
		.string()
		.min(1, "Slug is required")
		.regex(
			/^[a-z0-9-]+$/,
			"Slug must contain only lowercase letters, numbers, and hyphens",
		),
	isPrivate: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export function CreateStatusPageForm({
	open,
	onOpenChange,
	onSuccess,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
}) {
	const queryClient = useQueryClient();

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			slug: "",
			isPrivate: false,
		},
	});

	const { mutate, isPending } = useMutation({
		mutationFn: (data: FormValues) => client.statusPages.create(data),
		onSuccess: () => {
			toast.success("Status page created successfully");
			queryClient.invalidateQueries({
				queryKey: orpc.statusPages.list.key(),
			});
			onSuccess?.();
		},
		onError: (error: Error) => {
			toast.error(`Failed to create status page: ${error.message}`);
		},
	});

	function onSubmit(values: FormValues) {
		mutate(values);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create Status Page</DialogTitle>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input placeholder="My Status Page" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="slug"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Slug</FormLabel>
									<FormControl>
										<div className="flex rounded-md shadow-sm ring-1 ring-inset ring-gray-300 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-600 sm:max-w-md">
											<span className="flex select-none items-center pl-3 text-gray-500 sm:text-sm">
												uptimekit.com/s/
											</span>
											<Input
												{...field}
												className="block flex-1 border-0 bg-transparent py-1.5 pl-1 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm sm:leading-6 shadow-none"
												placeholder="my-page"
											/>
										</div>
									</FormControl>
									<FormDescription>
										Your status page will be accessible at this URL.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="isPrivate"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
									<div className="space-y-0.5">
										<FormLabel className="text-base">
											Private Status Page
										</FormLabel>
										<div className="text-muted-foreground text-sm">
											Private pages are only accessible to your team members.
										</div>
									</div>
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
											disabled={isPending}
										/>
									</FormControl>
								</FormItem>
							)}
						/>

						<div className="flex justify-end">
							<Button type="submit" disabled={isPending}>
								{isPending ? "Creating..." : "Create Status Page"}
							</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
