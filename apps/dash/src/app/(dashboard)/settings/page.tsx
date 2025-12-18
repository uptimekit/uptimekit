"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";

const formSchema = z.object({
	name: z.string().min(2, {
		message: "Name must be at least 2 characters.",
	}),
	slug: z
		.string()
		.min(2, {
			message: "Slug must be at least 2 characters.",
		})
		.regex(/^[a-z0-9-]+$/, {
			message: "Slug can only contain lowercase letters, numbers, and dashes.",
		}),
	logo: z
		.string()
		.url({
			message: "Please enter a valid URL.",
		})
		.optional()
		.or(z.literal("")),
});

export default function SettingsPage() {
	const { data: activeOrg, isPending } = authClient.useActiveOrganization();

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			slug: "",
			logo: "",
		},
	});

	// Update form when activeOrg loads
	useEffect(() => {
		if (activeOrg) {
			form.reset({
				name: activeOrg.name,
				slug: activeOrg.slug,
				logo: activeOrg.logo || "",
			});
		}
	}, [activeOrg, form]);

	async function onSubmit(values: z.infer<typeof formSchema>) {
		if (!activeOrg?.id) return;

		await authClient.organization.update(
			{
				organizationId: activeOrg.id,
				data: {
					name: values.name,
					slug: values.slug,
					logo: values.logo || undefined,
				},
			},
			{
				onSuccess: () => {
					toast.success("Organization settings updated");
				},
				onError: (ctx) => {
					toast.error(ctx.error.message);
					if (
						ctx.error.message?.toLowerCase().includes("slug") ||
						ctx.error.message?.toLowerCase().includes("unique")
					) {
						form.setError("slug", {
							message: "This slug is already taken",
						});
					}
				},
			},
		);
	}

	if (isPending) {
		return (
			<div className="flex h-full w-full items-center justify-center">
				<div className="text-muted-foreground">Loading...</div>
			</div>
		);
	}

	if (!activeOrg) {
		return (
			<div className="flex h-full w-full items-center justify-center">
				<div className="text-muted-foreground">No active organization</div>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col py-8">
			<div className="mx-auto w-full max-w-6xl space-y-4 px-4">
				<div className="flex flex-col gap-6">
					<div>
						<h1 className="font-bold text-2xl tracking-tight">
							Organization Settings
						</h1>
						<p className="text-muted-foreground">
							Manage your organization details.
						</p>
					</div>
					<Separator />

					<Card>
						<CardHeader>
							<CardTitle>General</CardTitle>
							<CardDescription>
								Update your organization's public information.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Form {...form}>
								<form
									onSubmit={form.handleSubmit(onSubmit)}
									className="space-y-4"
								>
									<FormField
										control={form.control}
										name="name"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Name</FormLabel>
												<FormControl>
													<Input placeholder="Acme Corp" {...field} />
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
													This is your organizations unique identifier.
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
												<FormLabel>Icon URL</FormLabel>
												<FormControl>
													<Input placeholder="https://..." {...field} />
												</FormControl>
												<FormDescription>
													A URL to your organizations logo.
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>
									<div className="flex justify-end">
										<Button type="submit">Save Changes</Button>
									</div>
								</form>
							</Form>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
