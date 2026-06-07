"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { sileo } from "sileo";
import { z } from "zod";
import { Loader2 } from "@/components/icons";
import { ApiKeySettings } from "@/components/settings/api-key-settings";
import { GroupSettings } from "@/components/settings/group-settings";
import { LogoEditor } from "@/components/settings/logo-editor";
import { OidcSettings } from "@/components/settings/oidc-settings";
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
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
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
		.url({
			message: "Please enter a valid URL.",
		})
		.optional()
		.or(z.literal("")),
});

interface OrganizationSettingsClientProps {
	organizationId: string;
}

function LoadingState({ label = "Loading organization settings..." }) {
	return (
		<div className="flex h-full min-h-80 w-full items-center justify-center">
			<div className="flex items-center gap-2 text-muted-foreground">
				<Loader2 className="size-4 animate-spin" />
				{label}
			</div>
		</div>
	);
}

export function OrganizationSettingsClient({
	organizationId,
}: OrganizationSettingsClientProps) {
	return (
		<Suspense fallback={<LoadingState />}>
			<OrganizationSettingsPageContent organizationId={organizationId} />
		</Suspense>
	);
}

function OrganizationSettingsPageContent({
	organizationId,
}: OrganizationSettingsClientProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [isSwitchingOrg, setIsSwitchingOrg] = useState(false);
	const {
		data: activeOrg,
		isPending: isLoadingActiveOrg,
		refetch: refetchActiveOrg,
	} = authClient.useActiveOrganization();
	const { data: session, isPending: isLoadingSession } =
		authClient.useSession();
	const { data: organizations, isPending: isLoadingOrganizations } =
		authClient.useListOrganizations();
	const [activeTab, setActiveTab] = useQueryState(
		"activeTab",
		parseAsStringEnum([
			"general",
			"team",
			"sso",
			"api-keys",
			"groups",
			"tags",
		]).withDefault("general"),
	);

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			slug: "",
			logo: "",
		},
	});

	const targetOrganization = useMemo(
		() => organizations?.find((org) => org.id === organizationId),
		[organizations, organizationId],
	);

	const currentMember = activeOrg?.members?.find(
		(member) => member.userId === session?.user.id,
	);
	const canManageOrganization =
		currentMember?.role === "owner" || currentMember?.role === "admin";

	const getFormValuesFromActiveOrg = useCallback(
		(): z.infer<typeof formSchema> => ({
			name: activeOrg?.name || "",
			slug: activeOrg?.slug || "",
			logo: activeOrg?.logo || "",
		}),
		[activeOrg],
	);

	useEffect(() => {
		if (
			isLoadingActiveOrg ||
			isLoadingOrganizations ||
			!targetOrganization ||
			activeOrg?.id === organizationId
		) {
			return;
		}

		setIsSwitchingOrg(true);
		void authClient.organization.setActive(
			{ organizationId },
			{
				onSuccess: async () => {
					await queryClient.invalidateQueries();
					await refetchActiveOrg();
					router.refresh();
					setIsSwitchingOrg(false);
				},
				onError: (ctx) => {
					sileo.error({ title: ctx.error.message });
					setIsSwitchingOrg(false);
				},
			},
		);
	}, [
		activeOrg?.id,
		isLoadingActiveOrg,
		isLoadingOrganizations,
		organizationId,
		queryClient,
		refetchActiveOrg,
		router,
		targetOrganization,
	]);

	useEffect(() => {
		if (activeOrg) {
			form.reset(getFormValuesFromActiveOrg());
		}
	}, [activeOrg, form, getFormValuesFromActiveOrg]);

	useEffect(() => {
		if (
			!canManageOrganization &&
			(activeTab === "api-keys" || activeTab === "sso")
		) {
			void setActiveTab("general");
		}
	}, [activeTab, canManageOrganization, setActiveTab]);

	const submitForm = async (values: z.infer<typeof formSchema>) => {
		if (!activeOrg?.id || !canManageOrganization) return;

		const nextValues = {
			name: values.name.trim(),
			slug: values.slug.trim(),
			logo: values.logo?.trim() || "",
		};

		await authClient.organization.update(
			{
				organizationId: activeOrg.id,
				data: nextValues,
			},
			{
				onSuccess: async () => {
					sileo.success({ title: "Organization settings updated" });
					form.reset(nextValues);
					await refetchActiveOrg();
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

	if (
		isLoadingActiveOrg ||
		isLoadingOrganizations ||
		isLoadingSession ||
		isSwitchingOrg
	) {
		return <LoadingState />;
	}

	if (!targetOrganization) {
		return (
			<div className="flex h-full min-h-80 w-full items-center justify-center">
				<div className="text-center">
					<h1 className="font-semibold text-lg">Organization not found</h1>
					<p className="text-muted-foreground text-sm">
						You do not have access to this organization.
					</p>
				</div>
			</div>
		);
	}

	if (activeOrg?.id !== organizationId) {
		return <LoadingState label="Switching organization..." />;
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
						{canManageOrganization && (
							<>
								<TabsTab value="sso">SSO</TabsTab>
								<TabsTab value="api-keys">API Keys</TabsTab>
							</>
						)}
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
																<Input
																	placeholder="Acme Corp"
																	disabled={!canManageOrganization}
																	{...field}
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
														<FormItem className="flex h-full flex-col">
															<FormLabel className="flex h-6 items-end pb-1">
																Slug
															</FormLabel>
															<FormControl>
																<Input
																	placeholder="acme-corp"
																	disabled={!canManageOrganization}
																	{...field}
																/>
															</FormControl>
															<FormDescription>
																This is your organization's unique identifier.
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
																	readOnly={!canManageOrganization}
																/>
																<div className="text-muted-foreground text-sm">
																	<p>
																		{canManageOrganization
																			? "Upload a logo for your organization."
																			: "Organization logo."}
																	</p>
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

								{canManageOrganization && (
									<div className="sticky bottom-0 z-10 flex justify-end gap-4 border-t bg-background/80 p-4 backdrop-blur-sm">
										<Button
											type="button"
											variant="outline"
											disabled={!form.formState.isDirty}
											onClick={handleDiscard}
										>
											Discard
										</Button>
										<Button
											type="button"
											loading={form.formState.isSubmitting}
											disabled={
												!form.formState.isDirty || form.formState.isSubmitting
											}
											onClick={handleSave}
										>
											Save Changes
										</Button>
									</div>
								)}
							</form>
						</Form>
					</TabsPanel>

					<TabsPanel value="team">
						<TeamSettings canManageMembers={canManageOrganization} />
					</TabsPanel>

					{canManageOrganization && (
						<TabsPanel value="sso">
							<OidcSettings />
						</TabsPanel>
					)}

					{canManageOrganization && (
						<TabsPanel value="api-keys">
							<ApiKeySettings />
						</TabsPanel>
					)}

					<TabsPanel value="groups">
						<GroupSettings readOnly={!canManageOrganization} />
					</TabsPanel>

					<TabsPanel value="tags">
						<TagSettings readOnly={!canManageOrganization} />
					</TabsPanel>
				</Tabs>
			</div>
		</div>
	);
}
