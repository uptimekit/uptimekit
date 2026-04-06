"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { client, orpc } from "@/utils/orpc";

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
			form.reset();
			onOpenChange(false);
			onSuccess?.();
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to create status page");
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
					<form onSubmit={form.handleSubmit(onSubmit)} className="contents">
						<DialogPanel className="space-y-4">
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
											<div className="flex h-9 items-center rounded-md border border-input bg-transparent focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
												<span className="shrink-0 select-none pl-3 text-muted-foreground text-sm">
													{process.env.NEXT_PUBLIC_STATUS_PAGE_DOMAIN ||
														"status.uptimekit.dev"}
													/
												</span>
												<Input
													{...field}
													className="h-full border-0 bg-transparent pl-1 shadow-none focus-visible:border-0 focus-visible:ring-0"
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
						</DialogPanel>

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
