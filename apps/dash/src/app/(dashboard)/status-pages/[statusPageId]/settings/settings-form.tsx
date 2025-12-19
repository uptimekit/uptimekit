"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ExternalLink,
	Image as ImageIcon,
	LayoutGrid,
	LayoutList,
	Loader2,
} from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Badge } from "@/components/ui/badge";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { client, orpc } from "@/utils/orpc";

const settingsSchema = z.object({
	name: z.string().min(1, "Company name is required"),
	slug: z.string().min(1, "Subdomain is required"),
	logoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
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
	theme: z.enum(["light", "dark"]),
	headerLayout: z.enum(["vertical", "horizontal"]),
	customDomain: z.string().optional().or(z.literal("")),
	isPrivate: z.boolean(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

interface SettingsFormProps {
	statusPageId: string;
}

// Settings form for status page configuration
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
			toast.success("Status page updated successfully");
		},
		onError: (err: Error) => {
			toast.error(err.message);
		},
	});

	const form = useForm<SettingsFormValues>({
		resolver: zodResolver(settingsSchema),
		defaultValues: {
			name: "",
			slug: "",
			logoUrl: "",
			websiteUrl: "",
			contactUrl: "",
			theme: "light",
			headerLayout: "vertical",
			customDomain: "",
			isPrivate: false,
		},
	});

	useEffect(() => {
		if (statusPage) {
			const design = (statusPage.design as any) || {};
			form.reset({
				name: statusPage.name,
				slug: statusPage.slug,
				logoUrl: design.logoUrl || "",
				websiteUrl: design.websiteUrl || "",
				contactUrl: design.contactUrl || "",
				theme: design.theme || "light",
				headerLayout: design.headerLayout || "vertical",
				customDomain: statusPage.domain || "",
				isPrivate: !statusPage.public,
			});
		}
	}, [statusPage, form]);

	function onSubmit(data: SettingsFormValues) {
		updateStatusPage.mutate({
			id: statusPageId,
			name: data.name,
			slug: data.slug,
			domain: data.customDomain || null,
			public: !data.isPrivate,
			design: {
				logoUrl: data.logoUrl,
				websiteUrl: data.websiteUrl,
				contactUrl: data.contactUrl,
				theme: data.theme,
				headerLayout: data.headerLayout,
			},
		});
	}

	if (isLoading) {
		return (
			<div className="flex justify-center p-10">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10 pb-20">
				{/* Basic Information */}
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
										<FormItem className="relative flex h-full flex-col">
											<div className="absolute inset-0 z-10 flex items-center justify-center">
												<Badge className="border-0 bg-white text-neutral-900 shadow-md hover:bg-neutral-100">
													Soon
												</Badge>
											</div>
											<div className="pointer-events-none flex h-full select-none flex-col opacity-50 blur-[2px]">
												<FormLabel className="flex h-6 items-end pb-1">
													Subdomain *
												</FormLabel>
												<div className="flex rounded-md shadow-sm ring-1 ring-input ring-inset">
													<Input
														placeholder="acme"
														{...field}
														disabled
														className="min-w-0 rounded-r-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
													/>
													<div className="flex select-none items-center rounded-r-md border-l bg-muted/50 px-3 text-muted-foreground text-sm">
														.uptimekit.com
													</div>
												</div>
												<FormDescription className="pt-2">
													You can configure a custom domain below.
												</FormDescription>
												<FormMessage />
											</div>
										</FormItem>
									)}
								/>
							</div>
						</CardContent>
					</Card>
				</div>

				<Separator />

				{/* Links & URLs */}
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

				{/* Personalization */}
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
												defaultValue={field.value ? "private" : "public"}
												value={field.value ? "private" : "public"}
												disabled
											>
												<SelectTrigger className="w-full">
													<SelectValue placeholder="Select visibility" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="public">Public</SelectItem>
													<SelectItem value="private">Private</SelectItem>
												</SelectContent>
											</Select>
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
												defaultValue={field.value}
												value={field.value}
											>
												<SelectTrigger className="w-full">
													<SelectValue placeholder="Select theme" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="dark">Dark version</SelectItem>
													<SelectItem value="light">Light version</SelectItem>
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<FormField
								control={form.control}
								name="headerLayout"
								render={({ field }) => (
									<FormItem className="space-y-3">
										<FormLabel>Page design</FormLabel>
										<FormControl>
											<RadioGroup
												onValueChange={field.onChange}
												defaultValue={field.value}
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
														<div className="cursor-pointer rounded-lg border-2 border-muted bg-popover p-4 transition-all hover:bg-accent hover:text-accent-foreground">
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
																	className={`ml-auto h-4 w-4 rounded-full border border-primary ${field.value === "vertical" ? "bg-primary" : "opacity-0"}`}
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
																disabled
															/>
														</FormControl>
														<div className="relative cursor-not-allowed rounded-lg border-2 border-muted bg-popover p-4 opacity-50">
															<div className="absolute top-2 right-2 origin-top-right scale-75">
																<Badge
																	variant="secondary"
																	className="pointer-events-none text-[10px]"
																>
																	Soon
																</Badge>
															</div>
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
																	className={`ml-auto h-4 w-4 rounded-full border border-primary ${field.value === "horizontal" ? "bg-primary" : "opacity-0"}`}
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
													{/* eslint-disable-next-line @next/next/no-img-element */}
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
						</CardContent>
					</Card>
				</div>

				<Separator />

				{/* Custom Domain */}
				<div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
					<div className="space-y-2">
						<h2 className="font-semibold text-lg leading-none tracking-tight">
							Custom domain
						</h2>
						<p className="text-muted-foreground text-sm">
							Deploy your status page to a custom subdomain for a branded
							experience.
						</p>
						{/* <Button variant="link" className="px-0 text-primary h-auto">
							Need help with the setup? Let us know
						</Button> */}
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
											{/* {field.value && (
												<div className="flex items-center gap-1.5 text-sm text-green-500 font-medium px-2 shrink-0">
													<Check className="h-4 w-4" />
													The CNAME is configured correctly
												</div>
											)} */}
										</div>
										<FormMessage />
									</FormItem>
								)}
							/>

							{/* <div className="rounded-lg border bg-muted/50 p-4 space-y-4">
								<h4 className="font-semibold text-sm">DNS Configuration</h4>
								<p className="text-sm text-muted-foreground">
									Please point{" "}
									<span className="font-bold text-foreground">
										{form.watch("customDomain") || "your domain"}
									</span>{" "}
									to UptimeKit by configuring the following CNAME record.
								</p>

								<div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
									<div>Record Type</div>
									<div>Host</div>
									<div>Target</div>
								</div>
								<div className="grid grid-cols-3 gap-2 text-sm bg-background p-3 rounded border items-center">
									<div className="font-mono">CNAME</div>
									<div
										className="font-mono truncate"
										title={form.watch("customDomain") || "status.domain.com"}
									>
										{form.watch("customDomain") || "status.domain.com"}
									</div>
									<div className="font-mono flex items-center justify-between gap-2">
										statuspage.uptimekit.com
										<Button variant="ghost" size="icon" className="h-6 w-6">
											<Copy className="h-3 w-3" />
										</Button>
									</div>
								</div>
							</div> */}
						</CardContent>
					</Card>
				</div>

				<div className="fixed right-0 bottom-0 left-0 z-0 flex justify-end gap-4 border-t bg-background/80 p-4 backdrop-blur-sm">
					<Button type="button" variant="outline" onClick={() => form.reset()}>
						Discard
					</Button>
					<Button type="submit" disabled={updateStatusPage.isPending}>
						{updateStatusPage.isPending && (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						)}
						Save changes
					</Button>
				</div>
			</form>
		</Form>
	);
}
