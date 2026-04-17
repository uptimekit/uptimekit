"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { sileo } from "sileo";
import { z } from "zod";
import { GroupSettings } from "@/components/settings/group-settings";
import { LogoEditor } from "@/components/settings/logo-editor";
import { TagSettings } from "@/components/settings/tag-settings";
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
import { authClient } from "@/lib/auth-client";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";

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
		.url({
			message: "Please enter a valid URL.",
		})
		.optional()
		.or(z.literal("")),
});

/**
 * Render the Organization Settings page with editable General, Team, Groups, and Tags sections.
 *
 * Syncs form state with the active organization, shows loading/no-active-organization states,
 * and submits updates to the organization (displaying success or error toasts and mapping slug conflicts to a form error).
 *
 * @returns The Settings page React element.
 */
export default function SettingsPage() {
	const { data: activeOrg, isPending } = authClient.useActiveOrganization();
	const [activeTab, setActiveTab] = useQueryState(
		"activeTab",
		parseAsStringEnum(["general", "team", "groups", "tags"]).withDefault(
			"general",
		),
	);

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			slug: "",
			logo: "",
		},
	});

	const getFormValuesFromActiveOrg = useCallback(
		(): z.infer<typeof formSchema> => ({
			name: activeOrg?.name || "",
			slug: activeOrg?.slug || "",
			logo: activeOrg?.logo || "",
		}),
		[activeOrg],
	);

	// Update form when activeOrg loads
	useEffect(() => {
		if (activeOrg) {
			form.reset(getFormValuesFromActiveOrg());
		}
	}, [activeOrg, form, getFormValuesFromActiveOrg]);

	const submitForm = async (values: z.infer<typeof formSchema>) => {
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
					sileo.success({ title: "Organization settings updated" });
				},
				onError: (ctx) => {
					sileo.error({ title: ctx.error.message });
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
	};

	const handleDiscard = () => {
		form.reset(getFormValuesFromActiveOrg());
	};

	const handleSave = () => {
		void form.handleSubmit(submitForm)();
	};

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

				<Tabs value={activeTab} onValueChange={(e) => setActiveTab(e)}>
					<TabsList variant="underline" className="mb-6">
						<TabsTab value="general">General</TabsTab>
						<TabsTab value="team">Team</TabsTab>
						<TabsTab value="groups">Groups</TabsTab>
						<TabsTab value="tags">Tags</TabsTab>
					</TabsList>

					<TabsPanel value="general">
						<Form {...form}>
							<form
								onSubmit={form.handleSubmit(submitForm)}
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

								<div className="sticky bottom-0 z-10 flex justify-end gap-4 border-t bg-background/80 p-4 backdrop-blur-sm">
									<Button
										type="button"
										variant="outline"
										onClick={handleDiscard}
									>
										Discard
									</Button>
									<Button type="button" onClick={handleSave}>
										Save Changes
									</Button>
								</div>
							</form>
						</Form>
					</TabsPanel>

					<TabsPanel value="team">
						<TeamSettings />
					</TabsPanel>

					<TabsPanel value="groups">
						<GroupSettings />
					</TabsPanel>

					<TabsPanel value="tags">
						<TagSettings />
					</TabsPanel>
				</Tabs>
			</div>
		</div>
	);
}
