"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { toast } from "sonner";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogPanel,
	DialogPopup,
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
import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/utils/orpc";

const formSchema = z.object({
	name: z.string().min(2, {
		message: "Name must be at least 2 characters.",
	}),
	slug: z.string().min(2, {
		message: "Slug must be at least 2 characters.",
	}),
	logo: z.string().min(0).url().optional().or(z.literal("")),
});

interface CreateOrganizationDialogProps {
	open: boolean;
	setOpen: (open: boolean) => void;
}

export function CreateOrganizationDialog({
	open,
	setOpen,
}: CreateOrganizationDialogProps) {
	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			slug: "",
			logo: "",
		},
	});
	const router = useRouter();

	const isLoading = form.formState.isSubmitting;

	async function onSubmit(values: z.infer<typeof formSchema>) {
		await authClient.organization.create(
			{
				name: values.name,
				slug: values.slug,
				logo: values.logo || undefined,
			},
			{
				onSuccess: async (ctx) => {
					if (ctx.data?.id) {
						try {
							await authClient.organization.setActive({
								organizationId: ctx.data.id,
							});
							toast.success("Organization created successfully");
							setOpen(false);
							form.reset();
							await queryClient.invalidateQueries();
							router.refresh();
							router.push("/");
						} catch {
							toast.error("Organization created but failed to switch");
						}
					}
				},
				onError: (ctx) => {
					toast.error(ctx.error.message);
				},
			},
		);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogPopup className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Create Organization</DialogTitle>
					<DialogDescription>
						Add a new organization to manage projects and team members.
					</DialogDescription>
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
											<Input
												placeholder="Acme Corp"
												{...field}
												onChange={(e) => {
													field.onChange(e);
													const slug = e.target.value
														.toLowerCase()
														.replace(/[^a-z0-9]+/g, "-")
														.replace(/^-+|-+$/g, "");
													form.setValue("slug", slug);
												}}
											/>
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
											<Input placeholder="acme-corp" {...field} />
										</FormControl>
										<FormDescription>
											This will be used in your organization URL.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="logo"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Logo URL</FormLabel>
										<FormControl>
											<Input placeholder="https://..." {...field} />
										</FormControl>
										<FormDescription>
											Optional. A direct link to your organization's logo.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</DialogPanel>
						<DialogFooter>
							<DialogClose render={<Button variant="ghost" />}>
								Cancel
							</DialogClose>
							<Button type="submit" disabled={isLoading}>
								{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								Create Organization
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogPopup>
		</Dialog>
	);
}
