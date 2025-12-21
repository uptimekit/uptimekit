"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { LogoEditor } from "@/components/settings/logo-editor";
import { TeamSettings } from "@/components/settings/team-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
					logo: values.logo || "",
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
		<div className="flex flex-1 flex-col py-8 pb-20">
			<div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">
						Organization Settings
					</h1>
					<p className="text-muted-foreground">
						Manage your organization details and team.
					</p>
				</div>

				<Tabs defaultValue="general" className="w-full gap-6">
					<TabsList className="flex h-auto w-full flex-wrap items-center justify-start gap-6 rounded-none border-border/40 border-b bg-transparent p-0 px-1 pt-2">
						<TabsTrigger
							value="general"
							className="relative h-auto flex-none rounded-none border-0 bg-transparent px-0 pb-3 font-medium text-muted-foreground text-sm shadow-none transition-colors hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:h-[2px] data-[state=active]:after:w-full data-[state=active]:after:bg-primary"
						>
							General
						</TabsTrigger>
						<TabsTrigger
							value="team"
							className="relative h-auto flex-none rounded-none border-0 bg-transparent px-0 pb-3 font-medium text-muted-foreground text-sm shadow-none transition-colors hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:h-[2px] data-[state=active]:after:w-full data-[state=active]:after:bg-primary"
						>
							Team
						</TabsTrigger>
					</TabsList>

					<TabsContent value="general" className="mt-6">
						<Form {...form}>
							<form
								onSubmit={form.handleSubmit(onSubmit)}
								className="space-y-10"
							>
								{/* General Section */}
								<div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
									<div className="space-y-2">
										<h2 className="font-semibold text-lg leading-none tracking-tight">
											General
										</h2>
										<p className="text-muted-foreground text-sm">
											Update your organization's public information.
										</p>
									</div>

									<Card className="md:col-span-2">
										<CardContent className="grid gap-6 p-6">
											<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
												<FormField
													control={form.control}
													name="name"
													render={({ field }) => (
														<FormItem className="flex h-full flex-col">
															<FormLabel className="flex h-6 items-end pb-1">
																Name
															</FormLabel>
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
														<FormItem className="flex h-full flex-col">
															<FormLabel className="flex h-6 items-end pb-1">
																Slug
															</FormLabel>
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
											</div>
										</CardContent>
									</Card>
								</div>

								<Separator />

								{/* Logo Section */}
								<div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
									<div className="space-y-2">
										<h2 className="font-semibold text-lg leading-none tracking-tight">
											Organization Logo
										</h2>
										<p className="text-muted-foreground text-sm">
											Upload your logo to personalize the look & feel of your
											organization.
										</p>
									</div>

									<Card className="md:col-span-2">
										<CardContent className="grid gap-6 p-6">
											<FormField
												control={form.control}
												name="logo"
												render={({ field }) => (
													<FormItem>
														{/* <FormLabel>Logo</FormLabel> */}
														<FormControl>
															<div className="flex items-center gap-4">
																<LogoEditor
																	value={field.value}
																	onChange={field.onChange}
																/>
																<div className="text-muted-foreground text-sm">
																	<p>Upload a logo for your organization.</p>
																	<p className="text-xs">
																		Recommended size: 256x256px.
																	</p>
																</div>
															</div>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										</CardContent>
									</Card>
								</div>

								{/* Fixed Footer */}
								<div className="fixed right-0 bottom-0 left-0 z-0 flex justify-end gap-4 border-t bg-background/80 p-4 backdrop-blur-sm">
									<Button
										type="button"
										variant="outline"
										onClick={() => form.reset()}
									>
										Discard
									</Button>
									<Button type="submit">Save Changes</Button>
								</div>
							</form>
						</Form>
					</TabsContent>

					<TabsContent value="team" className="mt-6">
						<TeamSettings />
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
