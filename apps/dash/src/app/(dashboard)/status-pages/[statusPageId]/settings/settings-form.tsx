"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ChevronDown,
	ExternalLink,
	Image as ImageIcon,
	LayoutGrid,
	LayoutList,
	Loader2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { sileo as toast } from "sileo";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	Select,
	SelectItem,
	SelectPopup,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { client, orpc } from "@/utils/orpc";

const settingsSchema = z.object({
	name: z.string().min(1, "Company name is required"),
	slug: z.string().min(1, "Subdomain is required"),
	logoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
	faviconUrl: z
		.string()
		.url("Must be a valid URL")
		.optional()
		.or(z.literal("")),
	websiteUrl: z
		.string()
		.url("Must be a valid URL")
		.optional()
		.or(z.literal("")),
	contactUrl: z
		.string()
		.email("Must be a valid email")
		.or(z.string().url("Must be a valid URL"))
		.optional()
		.or(z.literal("")),
	themeId: z.string().optional(),
	theme: z.enum(["light", "dark"]),
	headerLayout: z.enum(["vertical", "horizontal"]),
	barStyle: z.enum(["normal", "length"]),
	customDomain: z.string().optional().or(z.literal("")),
	isPrivate: z.boolean(),
	password: z
		.string()
		.min(6, "Password must be at least 6 characters")
		.optional()
		.or(z.literal("")),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

interface SettingsFormProps {
	statusPageId: string;
}

export function SettingsForm({ statusPageId }: SettingsFormProps) {
	const queryClient = useQueryClient();
	const { data: statusPage, isLoading } = useQuery(
		orpc.statusPages.get.queryOptions({
			input: { id: statusPageId },
		}),
	);

	const updateStatusPage = useMutation({
		mutationFn: (data: Parameters<typeof client.statusPages.update>[0]) =>
			client.statusPages.update(data),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: orpc.statusPages.get.queryOptions({
					input: { id: statusPageId },
				}).queryKey,
			});
			toast.success({ title: "Status page updated successfully" });
		},
		onError: (err: Error) => {
			toast.error({ title: err.message });
		},
	});

	const form = useForm<SettingsFormValues>({
		resolver: zodResolver(settingsSchema),
		defaultValues: {
			name: "",
			slug: "",
			logoUrl: "",
			faviconUrl: "",
			websiteUrl: "",
			contactUrl: "",
			themeId: "default",
			theme: "light",
			headerLayout: "vertical",
			barStyle: "normal",
			customDomain: "",
			isPrivate: false,
			password: "",
		},
	});

	const [faviconOpen, setFaviconOpen] = useState(false);

	const getFormValuesFromStatusPage = useCallback((): SettingsFormValues => {
		const design = (statusPage?.design as any) || {};

		return {
			name: statusPage?.name || "",
			slug: statusPage?.slug || "",
			logoUrl: design.logoUrl || "",
			faviconUrl: design.faviconUrl || "",
			websiteUrl: design.websiteUrl || "",
			contactUrl: design.contactUrl || "",
			themeId: design.themeId || "default",
			theme: design.theme || "light",
			headerLayout: design.headerLayout || "vertical",
			barStyle: design.barStyle || "normal",
			customDomain: statusPage?.domain || "",
			isPrivate: statusPage ? !statusPage.public : false,
			password: "",
		};
	}, [statusPage]);

	useEffect(() => {
		if (statusPage) {
			form.reset(getFormValuesFromStatusPage(), {
				keepDefaultValues: false,
			});
		}
	}, [statusPage, form, getFormValuesFromStatusPage]);

	const submitSettings = async (data: SettingsFormValues) => {
		if (data.isPrivate && !statusPage?.hasPassword && !data.password) {
			form.setError("password", {
				type: "manual",
				message: "Password is required for private status pages",
			});
			return;
		}

		await updateStatusPage.mutateAsync({
			id: statusPageId,
			name: data.name,
			slug: data.slug,
			domain: data.customDomain || null,
			public: !data.isPrivate,
			password: data.isPrivate ? data.password || undefined : null,
			design: {
				themeId: data.themeId,
				logoUrl: data.logoUrl,
				faviconUrl: data.faviconUrl,
				websiteUrl: data.websiteUrl,
				contactUrl: data.contactUrl,
				theme: data.theme,
				headerLayout: data.headerLayout,
				barStyle: data.barStyle,
			},
		});
	};

	const handleDiscard = () => {
		form.reset(getFormValuesFromStatusPage());
	};

	const handleSaveChanges = () => {
		void form.handleSubmit(submitSettings)();
	};

	if (isLoading) {
		return (
			<div className="flex justify-center p-10">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const themes = [
		{
			value: "default",
			label: "Default - Classic design with uptime history",
		},
		{
			value: "flat",
			label: "Flat - Simple and modern design",
		},
	];

	const colorThemes = [
		{ value: "dark", label: "Dark version" },
		{ value: "light", label: "Light version" },
	];

	const visibilityOptions = [
		{ value: "public", label: "Public" },
		{ value: "private", label: "Private" },
	];

	const optionCardClassName =
		"flex h-full min-h-18 cursor-pointer items-center rounded-lg border-2 border-muted bg-popover p-4 transition-all hover:bg-accent hover:text-accent-foreground";

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(submitSettings)}
				className="mb-10 space-y-10"
			>
				<div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<h2 className="font-semibold text-lg leading-none tracking-tight">
								Basic information
							</h2>
						</div>
						<p className="text-muted-foreground text-sm">
							A public status page informs your users about the uptime of your
							services.
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
												Company name *
											</FormLabel>
											<FormControl>
												<Input placeholder="Acme Inc." {...field} />
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
												Slug *
											</FormLabel>
											<div className="flex rounded-md shadow-sm ring-1 ring-input ring-inset">
												<div className="flex select-none items-center rounded-l-md border-r bg-muted/50 px-3 text-muted-foreground text-sm">
													{process.env.NEXT_PUBLIC_STATUS_PAGE_DOMAIN ||
														"status.uptimekit.dev"}
													/
												</div>
												<Input
													placeholder="acme"
													{...field}
													className="min-w-0 rounded-l-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
												/>
											</div>
											<FormDescription className="pt-2">
												Your status page URL. You can also configure a custom
												domain below.
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

				<div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
					<div className="space-y-2">
						<h2 className="font-semibold text-lg leading-none tracking-tight">
							Links & URLs
						</h2>
						<p className="text-muted-foreground text-sm">
							Where should we point your users when they want to visit your
							website?
						</p>
					</div>
					<Card className="md:col-span-2">
						<CardContent className="grid gap-6 p-6">
							<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
								<FormField
									control={form.control}
									name="websiteUrl"
									render={({ field }) => (
										<FormItem className="flex h-full flex-col">
											<FormLabel className="flex h-11 items-end pb-1">
												What URL should your logo point to?
											</FormLabel>
											<FormControl>
												<Input placeholder="https://example.com" {...field} />
											</FormControl>
											<FormDescription className="pt-1">
												What&apos;s your company&apos;s homepage?
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="contactUrl"
									render={({ field }) => (
										<FormItem className="flex h-full flex-col">
											<FormLabel className="flex h-11 items-end pb-1">
												Get in touch URL
											</FormLabel>
											<div className="relative">
												<Input
													placeholder="mailto:support@example.com"
													{...field}
												/>
												<div className="absolute top-2.5 right-3 text-muted-foreground">
													<ExternalLink className="h-4 w-4" />
												</div>
											</div>
											<FormDescription className="pt-1">
												You can use mailto:support@example.com. Leave blank for
												no &apos;Get in touch&apos; button.
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

				<div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
					<div className="space-y-2">
						<h2 className="font-semibold text-lg leading-none tracking-tight">
							Personalization
						</h2>
						<p className="text-muted-foreground text-sm">
							Upload your logo to personalize the look & feel of your status
							page.
						</p>
						<p className="pt-2 text-muted-foreground text-sm">
							Use modern look for refreshed design with latest features like
							dark theme, translations, and custom favicon.
						</p>
					</div>
					<Card className="md:col-span-2">
						<CardContent className="grid gap-6 p-6">
							<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
								<FormField
									control={form.control}
									name="themeId"
									render={({ field }) => (
										<FormItem className="flex h-full flex-col">
											<FormLabel className="flex h-6 items-end pb-1">
												Page theme
											</FormLabel>
											<Select
												onValueChange={field.onChange}
												value={field.value}
												aria-label="Select theme"
												defaultValue="default"
												items={themes}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectPopup>
													{themes.map(({ label, value }) => (
														<SelectItem key={value} value={value}>
															{label}
														</SelectItem>
													))}
												</SelectPopup>
											</Select>
											<FormDescription className="pt-2">
												Choose the layout and style for your status page
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="theme"
									render={({ field }) => (
										<FormItem className="flex h-full flex-col">
											<FormLabel className="flex h-6 items-end pb-1">
												Color theme
											</FormLabel>
											<Select
												onValueChange={field.onChange}
												value={field.value}
												items={colorThemes}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectPopup>
													{colorThemes.map(({ label, value }) => (
														<SelectItem key={value} value={value}>
															{label}
														</SelectItem>
													))}
												</SelectPopup>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
								<FormField
									control={form.control}
									name="isPrivate"
									render={({ field }) => (
										<FormItem className="flex h-full flex-col">
											<FormLabel className="flex h-6 items-end pb-1">
												Status page visibility
											</FormLabel>
											<Select
												onValueChange={(val) =>
													field.onChange(val === "private")
												}
												value={field.value ? "private" : "public"}
												items={visibilityOptions}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectPopup>
													{visibilityOptions.map(({ label, value }) => (
														<SelectItem key={value} value={value}>
															{label}
														</SelectItem>
													))}
												</SelectPopup>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							{form.watch("isPrivate") && (
								<FormField
									control={form.control}
									name="password"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Password</FormLabel>
											<FormControl>
												<Input
													type="password"
													placeholder={
														statusPage?.hasPassword
															? "Leave empty to keep existing password"
															: "Enter a password"
													}
													{...field}
												/>
											</FormControl>
											<FormDescription>
												{statusPage?.hasPassword ? (
													<span className="text-green-600 dark:text-green-400">
														Password is currently set.{" "}
													</span>
												) : null}
												Visitors will need to enter this password to view your
												status page.
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							)}

							<FormField
								control={form.control}
								name="headerLayout"
								render={({ field }) => (
									<FormItem className="space-y-3">
										<FormLabel>Page design</FormLabel>
										<FormControl>
											<RadioGroup
												onValueChange={field.onChange}
												value={field.value}
												className="grid grid-cols-1 gap-4 md:grid-cols-2"
											>
												<FormItem>
													<FormLabel className="pb-2 [&:has([data-state=checked])>div]:border-primary">
														<FormControl>
															<RadioGroupItem
																value="vertical"
																className="sr-only"
															/>
														</FormControl>
														<div className={optionCardClassName}>
															<div className="flex items-center gap-4">
																<div className="flex h-10 w-16 items-center justify-center rounded bg-muted/20">
																	<LayoutList className="h-5 w-5 text-muted-foreground/50" />
																</div>
																<div className="space-y-1">
																	<div className="font-medium leading-none">
																		List layout
																	</div>
																	<div className="text-muted-foreground text-xs">
																		Standard vertical list view of your services
																	</div>
																</div>
																<div
																	className={`ml-auto h-4 w-4 rounded-full border border-primary ${
																		field.value === "vertical"
																			? "bg-primary"
																			: "opacity-0"
																	}`}
																/>
															</div>
														</div>
													</FormLabel>
												</FormItem>
												<FormItem>
													<FormLabel className="group [&:has([data-state=checked])>div]:border-primary">
														<FormControl>
															<RadioGroupItem
																value="horizontal"
																className="sr-only"
															/>
														</FormControl>
														<div className={optionCardClassName}>
															<div className="flex items-center gap-4">
																<div className="flex h-10 w-16 items-center justify-center rounded bg-muted/20">
																	<LayoutGrid className="h-5 w-5 text-muted-foreground/50" />
																</div>
																<div className="space-y-1">
																	<div className="font-medium leading-none">
																		Grid layout
																	</div>
																	<div className="text-muted-foreground text-xs">
																		Grid view to show more services at once
																	</div>
																</div>
																<div
																	className={`ml-auto h-4 w-4 rounded-full border border-primary ${
																		field.value === "horizontal"
																			? "bg-primary"
																			: "opacity-0"
																	}`}
																/>
															</div>
														</div>
													</FormLabel>
												</FormItem>
											</RadioGroup>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="barStyle"
								render={({ field }) => (
									<FormItem className="space-y-3">
										<FormLabel>Uptime bar style</FormLabel>
										<FormControl>
											<RadioGroup
												onValueChange={field.onChange}
												value={field.value}
												className="grid grid-cols-1 gap-4 md:grid-cols-2"
											>
												<FormItem>
													<FormLabel className="pb-2 [&:has([data-state=checked])>div]:border-primary">
														<FormControl>
															<RadioGroupItem
																value="normal"
																className="sr-only"
															/>
														</FormControl>
														<div className={optionCardClassName}>
															<div className="flex items-center gap-4">
																<div className="flex h-10 w-16 flex-col justify-center gap-0.5 rounded bg-muted/20 px-2">
																	<div className="h-1.5 w-full rounded-sm bg-green-500/70" />
																	<div className="h-1.5 w-full rounded-sm bg-green-500/70" />
																	<div className="h-1.5 w-full rounded-sm bg-green-500/70" />
																</div>
																<div className="space-y-1">
																	<div className="font-medium leading-none">
																		Normal
																	</div>
																	<div className="text-muted-foreground text-xs">
																		Single color per day
																	</div>
																</div>
																<div
																	className={`ml-auto h-4 w-4 rounded-full border border-primary ${
																		field.value === "normal"
																			? "bg-primary"
																			: "opacity-0"
																	}`}
																/>
															</div>
														</div>
													</FormLabel>
												</FormItem>
												<FormItem>
													<FormLabel className="group [&:has([data-state=checked])>div]:border-primary">
														<FormControl>
															<RadioGroupItem
																value="length"
																className="sr-only"
															/>
														</FormControl>
														<div className={optionCardClassName}>
															<div className="flex items-center gap-4">
																<div className="flex h-10 w-16 flex-col justify-center rounded bg-muted/20 px-2">
																	<div className="h-2 w-full rounded-t-sm bg-green-500/70" />
																	<div className="h-1 w-full bg-yellow-500/70" />
																	<div className="h-1 w-full rounded-b-sm bg-red-500/70" />
																</div>
																<div className="space-y-1">
																	<div className="font-medium leading-none">
																		Length
																	</div>
																	<div className="text-muted-foreground text-xs">
																		Shows downtime breakdown
																	</div>
																</div>
																<div
																	className={`ml-auto h-4 w-4 rounded-full border border-primary ${
																		field.value === "length"
																			? "bg-primary"
																			: "opacity-0"
																	}`}
																/>
															</div>
														</div>
													</FormLabel>
												</FormItem>
											</RadioGroup>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="logoUrl"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Logo URL</FormLabel>
										<div className="flex items-center gap-4 rounded-lg border bg-card p-4">
											{field.value ? (
												<div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-muted">
													<img
														src={field.value}
														alt="Logo preview"
														className="h-full w-full object-contain p-1"
													/>
												</div>
											) : (
												<div className="flex h-12 w-12 items-center justify-center rounded-md border bg-muted">
													<ImageIcon className="h-6 w-6 text-muted-foreground" />
												</div>
											)}
											<div className="flex-1 space-y-2">
												<Input placeholder="https://..." {...field} />
												<p className="text-muted-foreground text-xs">
													Enter a direct link to your logo image (PNG, JPG,
													SVG).
												</p>
											</div>
										</div>
									</FormItem>
								)}
							/>

							<Collapsible open={faviconOpen} onOpenChange={setFaviconOpen}>
								<CollapsibleTrigger
									render={
										<Button
											variant="ghost"
											className="flex w-full items-center justify-between p-0 hover:bg-transparent"
											type="button"
										>
											<span className="text-muted-foreground text-sm">
												Custom Favicon (Optional)
											</span>
											<ChevronDown
												className={cn(
													"h-4 w-4 text-muted-foreground transition-transform duration-200",
													faviconOpen && "rotate-180",
												)}
											/>
										</Button>
									}
								/>
								<CollapsibleContent className="mt-4">
									<FormField
										control={form.control}
										name="faviconUrl"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Favicon URL</FormLabel>
												<div className="flex items-center gap-4 rounded-lg border bg-card p-4">
													{field.value ? (
														<div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-muted">
															<img
																src={field.value}
																alt="Favicon preview"
																className="h-full w-full object-contain p-1"
															/>
														</div>
													) : (
														<div className="flex h-12 w-12 items-center justify-center rounded-md border bg-muted">
															<ImageIcon className="h-6 w-6 text-muted-foreground" />
														</div>
													)}
													<div className="flex-1 space-y-2">
														<Input placeholder="https://..." {...field} />
														<p className="text-muted-foreground text-xs">
															Custom favicon for browser tabs. If not set, your
															logo will be used as the favicon.
														</p>
													</div>
												</div>
											</FormItem>
										)}
									/>
								</CollapsibleContent>
							</Collapsible>
						</CardContent>
					</Card>
				</div>

				<Separator />

				<div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
					<div className="space-y-2">
						<h2 className="font-semibold text-lg leading-none tracking-tight">
							Custom domain
						</h2>
						<p className="text-muted-foreground text-sm">
							Deploy your status page to a custom subdomain for a branded
							experience.
						</p>
					</div>
					<Card className="md:col-span-2">
						<CardContent className="grid gap-6 p-6">
							<FormField
								control={form.control}
								name="customDomain"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Custom domain</FormLabel>
										<div className="flex gap-2">
											<FormControl>
												<Input placeholder="status.example.com" {...field} />
											</FormControl>
										</div>
										<FormMessage />
									</FormItem>
								)}
							/>
						</CardContent>
					</Card>
				</div>
			</form>

			<div
				id="statuspage-settings-footer"
				className="pointer-events-none fixed right-2 bottom-0 left-64 overflow-hidden rounded-b-lg border bg-popover/80 backdrop-blur-md"
			>
				<div className="pointer-events-auto flex justify-end gap-4 px-6 py-4">
					<Button
						type="button"
						variant="outline"
						onClick={handleDiscard}
						disabled={updateStatusPage.isPending}
					>
						Discard
					</Button>
					<Button
						type="button"
						onClick={handleSaveChanges}
						disabled={updateStatusPage.isPending}
					>
						{updateStatusPage.isPending && (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						)}
						Save changes
					</Button>
				</div>
			</div>
		</Form>
	);
}
