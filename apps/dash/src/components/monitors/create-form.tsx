"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Activity,
	Braces,
	ChevronRight,
	Globe,
	Plus,
	Search,
	Server,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { type UseFormReturn, useFieldArray, useForm } from "react-hook-form";
import { sileo } from "sileo";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	ComboboxPopup,
	ComboboxValue,
} from "@/components/ui/combobox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
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

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getRegionInfo } from "@/lib/regions";
import { cn } from "@/lib/utils";
import { client, orpc } from "@/utils/orpc";
import { GroupCreationDialog } from "./group-creation-dialog";
import { TagCreationDialog } from "./tag-creation-dialog";
import { TagsManager } from "./tags-manager";

// --- Configuration Registry ---

const baseSchema = z.object({
	name: z.string().min(1, "Name is required"),
	interval: z.coerce.number().min(30),
	groupId: z.string().nullish(),
	tags: z.array(z.string()).default([]),
	incidentPendingDuration: z.coerce.number().default(0),
	incidentRecoveryDuration: z.coerce.number().default(0),
	publishIncidentToStatusPage: z.boolean().default(false),
	locations: z.array(z.string()).min(1, "At least one region must be selected"),
});

const httpSchema = z.object({
	type: z.literal("http"),
	url: z.string().url("Must be a valid URL"),
	checkSsl: z.boolean().default(true),
	sslCertExpiryNotificationDays: z.coerce.number().min(1).max(90).default(30),
	headers: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
	body: z.string().optional(),
	method: z
		.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])
		.default("GET"),
	acceptedStatusCodes: z.string().optional(),
});

const httpJsonSchema = z.object({
	type: z.literal("http-json"),
	url: z.string().url("Must be a valid URL"),
	jsonPath: z.string().min(1, "JSONata expression is required"),
	checkSsl: z.boolean().default(true),
	sslCertExpiryNotificationDays: z.coerce.number().min(1).max(90).default(30),
	headers: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
	body: z.string().optional(),
	method: z
		.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])
		.default("GET"),
	acceptedStatusCodes: z.string().optional(),
});

const keywordSchema = z.object({
	type: z.literal("keyword"),
	url: z.string().url("Must be a valid URL"),
	keyword: z.string().min(1, "Keyword is required"),
	checkSsl: z.boolean().default(true),
	sslCertExpiryNotificationDays: z.coerce.number().min(1).max(90).default(30),
	headers: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
	body: z.string().optional(),
	method: z
		.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])
		.default("GET"),
	acceptedStatusCodes: z.string().optional(),
});

const pingSchema = z.object({
	type: z.literal("ping"),
	hostname: z.string().min(1, "Hostname is required"),
});

const tcpSchema = z.object({
	type: z.literal("tcp"),
	hostname: z.string().min(1, "Hostname is required"),
	port: z.coerce.number().min(1).max(65535, "Port must be between 1 and 65535"),
});

// Union schema
const monitorConfigSchema = z.discriminatedUnion("type", [
	httpSchema,
	httpJsonSchema,
	keywordSchema,
	pingSchema,
	tcpSchema,
]);

const formSchema = z.intersection(baseSchema, monitorConfigSchema);

type FormValues = z.infer<typeof formSchema>;

// Registry for UI components and metadata
type MonitorTypeDefinition = {
	id: FormValues["type"];
	label: string;
	description: string;
	icon: React.ElementType;
	group: "Network & web" | "Infrastructure";
	// Component to render specific fields
	Fields: React.ComponentType<{ form: UseFormReturn<FormValues> }>;
};

// Reusable field components
const UrlField = ({ form }: { form: UseFormReturn<FormValues> }) => (
	<FormField
		control={form.control}
		name="url"
		render={({ field }) => (
			<FormItem>
				<FormLabel>Target URL</FormLabel>
				<FormControl>
					<Input placeholder="https://example.com" {...field} />
				</FormControl>
				<FormDescription>The URL you want to monitor.</FormDescription>
				<FormMessage />
			</FormItem>
		)}
	/>
);

const HostnameField = ({ form }: { form: UseFormReturn<FormValues> }) => (
	<FormField
		control={form.control}
		name="hostname"
		render={({ field }) => (
			<FormItem>
				<FormLabel>Hostname</FormLabel>
				<FormControl>
					<Input placeholder="example.com" {...field} />
				</FormControl>
				<FormMessage />
			</FormItem>
		)}
	/>
);

const TcpFields = ({ form }: { form: UseFormReturn<FormValues> }) => (
	<div className="flex gap-4">
		<div className="flex-1">
			<HostnameField form={form} />
		</div>
		<div className="w-32">
			<FormField
				control={form.control}
				name="port"
				render={({ field }) => (
					<FormItem>
						<FormLabel>Port</FormLabel>
						<FormControl>
							<Input placeholder="80" {...field} type="number" />
						</FormControl>
						<FormMessage />
					</FormItem>
				)}
			/>
		</div>
	</div>
);

const KeywordFields = ({ form }: { form: UseFormReturn<FormValues> }) => (
	<>
		<UrlField form={form} />
		<FormField
			control={form.control}
			name="keyword"
			render={({ field }) => (
				<FormItem>
					<FormLabel>Keyword</FormLabel>
					<FormControl>
						<Input placeholder="Error" {...field} />
					</FormControl>
					<FormDescription>
						Alert if this keyword is found on the page.
					</FormDescription>
					<FormMessage />
				</FormItem>
			)}
		/>
	</>
);

const HttpJsonFields = ({ form }: { form: UseFormReturn<FormValues> }) => (
	<>
		<UrlField form={form} />
		<FormField
			control={form.control}
			name="jsonPath"
			render={({ field }) => (
				<FormItem>
					<FormLabel>JSONata Expression</FormLabel>
					<FormControl>
						<Input placeholder="$.message = 'Hello World'" {...field} />
					</FormControl>
					<FormDescription>
						Expression to validate the JSON response.
					</FormDescription>
					<FormMessage />
				</FormItem>
			)}
		/>
	</>
);

const monitorTypes: MonitorTypeDefinition[] = [
	{
		id: "http",
		group: "Network & web",
		label: "HTTP(s)",
		description: "Monitor a website or API endpoint",
		icon: Globe,
		Fields: UrlField,
	},
	{
		id: "http-json",
		group: "Network & web",
		label: "HTTP JSON",
		description: "Validate JSON response from an API",
		icon: Braces,
		Fields: HttpJsonFields,
	},
	{
		id: "keyword",
		group: "Network & web",
		label: "HTTP Keyword",
		description: "Check if a keyword is present on a page",
		icon: Search,
		Fields: KeywordFields,
	},

	{
		id: "ping",
		group: "Infrastructure",
		label: "Ping",
		description: "Check reachability of a host",
		icon: Activity,
		Fields: HostnameField,
	},
	{
		id: "tcp",
		group: "Infrastructure",
		label: "Port (TCP)",
		description: "Monitor a specific port on a server",
		icon: Server,
		Fields: TcpFields,
	},
];

const _groupedTypes: { group: string; items: MonitorTypeDefinition[] }[] = [
	{
		group: "Network & web",
		items: monitorTypes.filter((t) => t.group === "Network & web"),
	},
	{
		group: "Infrastructure",
		items: monitorTypes.filter((t) => t.group === "Infrastructure"),
	},
];

// Add new Advanced Fields Components
const HttpAdvancedFields = ({ form }: { form: UseFormReturn<FormValues> }) => {
	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "headers",
	});

	return (
		<div className="space-y-4">
			<FormField
				control={form.control}
				name="checkSsl"
				render={({ field }) => (
					<>
						<FormItem className="flex flex-row items-center justify-between rounded-lg bg-muted/50 p-4">
							<div className="space-y-0.5">
								<FormLabel className="text-base">
									SSL & domain verification
								</FormLabel>
								<FormDescription>
									Receive an alert when your certificate is about to expire.
								</FormDescription>
							</div>
							<FormControl>
								<Switch
									checked={field.value}
									onCheckedChange={field.onChange}
								/>
							</FormControl>
						</FormItem>

						{field.value !== false && (
							<FormField
								control={form.control}
								name="sslCertExpiryNotificationDays"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Certificate expiration notification</FormLabel>
										<FormControl>
											<Input
												type="number"
												min={1}
												max={90}
												required
												value={field.value ?? 30}
												onChange={(e) =>
													field.onChange(
														e.target.value ? Number(e.target.value) : 30,
													)
												}
												onBlur={field.onBlur}
												name={field.name}
												ref={field.ref}
											/>
										</FormControl>
										<FormDescription>
											Number of days before SSL certificate expiration to send a
											notification (1-90 days).
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}
					</>
				)}
			/>

			<FormField
				control={form.control}
				name="acceptedStatusCodes"
				render={({ field }) => (
					<FormItem>
						<FormLabel>Accepted Status Codes</FormLabel>
						<FormControl>
							<Input placeholder="200-299, 301, 302" {...field} />
						</FormControl>
						<FormDescription>
							Define which HTTP status codes are considered "Up". Example:
							"200-204, 301, 302". Default is 200-299.
						</FormDescription>
						<FormMessage />
					</FormItem>
				)}
			/>

			<div className="space-y-2">
				<FormLabel>Request Headers</FormLabel>
				<div className="space-y-2">
					{fields.map((field, index) => (
						<div key={field.id} className="flex gap-2">
							<FormField
								control={form.control}
								name={`headers.${index}.key`}
								render={({ field }) => (
									<FormItem className="flex-1">
										<FormControl>
											<Input placeholder="Key" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name={`headers.${index}.value`}
								render={({ field }) => (
									<FormItem className="flex-1">
										<FormControl>
											<Input placeholder="Value" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<Button
								type="button"
								variant="outline"
								size="icon"
								onClick={() => remove(index)}
							>
								<span className="sr-only">Remove</span>
								<Plus className="h-4 w-4 rotate-45" />
							</Button>
						</div>
					))}
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="mt-2"
						onClick={() => append({ key: "", value: "" })}
					>
						<Plus className="mr-2 h-4 w-4" />
						Add Header
					</Button>
				</div>
			</div>

			<FormField
				control={form.control}
				name="body"
				render={({ field }) => (
					<FormItem>
						<div className="flex items-center justify-between">
							<FormLabel>Request Body</FormLabel>
							<Select
								onValueChange={(val) => val && form.setValue("method", val)}
								defaultValue={form.getValues("method") || "GET"}
							>
								<SelectTrigger className="h-8 w-[100px]">
									<SelectValue placeholder="Method" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="GET">GET</SelectItem>
									<SelectItem value="POST">POST</SelectItem>
									<SelectItem value="PUT">PUT</SelectItem>
									<SelectItem value="PATCH">PATCH</SelectItem>
									<SelectItem value="DELETE">DELETE</SelectItem>
									<SelectItem value="HEAD">HEAD</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<FormControl>
							<Textarea
								placeholder="{ 'key': 'value' }"
								className="font-mono"
								{...field}
							/>
						</FormControl>
						<FormMessage />
					</FormItem>
				)}
			/>
		</div>
	);
};

// ... (CreateMonitorForm update)

interface CreateMonitorFormProps {
	monitorId?: string;
	initialData?: FormValues & { active?: boolean };
}

/**
 * Renders a form for creating or editing a monitor and manages its client-side behavior.
 *
 * The form fetches available regions, groups, and tags; validates input against the form schema;
 * and submits a create or update request. On success it invalidates relevant queries and navigates
 * back to the monitors list; on failure it surfaces an error toast.
 *
 * @param monitorId - Optional monitor ID. If provided the form is initialized for editing and submission updates the existing monitor.
 * @param initialData - Optional initial values used to prefill the form for editing.
 * @returns The rendered CreateMonitorForm component UI.
 */
export function CreateMonitorForm({
	monitorId,
	initialData,
}: CreateMonitorFormProps) {
	// Fetch regions
	const { data: regions } = useQuery(orpc.workers.listLocations.queryOptions());
	const { data: groups } = useQuery(orpc.monitors.listGroups.queryOptions());
	const { data: tags } = useQuery(orpc.monitors.listTags.queryOptions());

	const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
	const [groupsOpen, setGroupsOpen] = useState(false);
	const [tagsOpen, setTagsOpen] = useState(false);
	const [manageTagsOpen, setManageTagsOpen] = useState(false);

	const getFormValuesFromInitialData = (): FormValues => {
		const defaults = (initialData as any) || {};
		return {
			name: defaults.name || "",
			type: defaults.type || "http",
			interval: defaults.interval || 60,
			groupId: defaults.groupId ?? null,
			tags:
				defaults.tags?.map((t: any) => (typeof t === "string" ? t : t.id)) ||
				[],
			checkSsl: defaults.checkSsl ?? true,
			sslCertExpiryNotificationDays:
				defaults.sslCertExpiryNotificationDays || 30,
			incidentPendingDuration: defaults.incidentPendingDuration || 0,
			incidentRecoveryDuration: defaults.incidentRecoveryDuration || 0,
			publishIncidentToStatusPage:
				defaults.publishIncidentToStatusPage ?? false,
			locations: defaults.locations || [],
			method: defaults.method || "GET",
			url: defaults.url || "",
			hostname: defaults.hostname || "",
			port: defaults.port || 80,
			keyword: defaults.keyword || "",
			jsonPath: defaults.jsonPath || "",
			body: defaults.body || "",
			headers: defaults.headers || [],
			acceptedStatusCodes: defaults.acceptedStatusCodes || "",
		} as FormValues;
	};

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema) as any,
		defaultValues: getFormValuesFromInitialData(),
	});

	const router = useRouter();
	const utils = useQueryClient();

	const { mutate, isPending } = useMutation({
		mutationFn: async (data: FormValues) => {
			// Transform form data to match API expectation
			const {
				type,
				name,
				interval,
				groupId,
				tags,
				locations,
				incidentPendingDuration,
				incidentRecoveryDuration,
				publishIncidentToStatusPage,
				...rest
			} = data;

			const payload = {
				type,
				name,
				interval,
				groupId,
				tags,
				locations,
				incidentPendingDuration,
				incidentRecoveryDuration,
				publishIncidentToStatusPage,
				config: rest,
			};

			if (monitorId) {
				return client.monitors.update({
					id: monitorId,
					...payload,
					active: initialData?.active ?? true,
				} as any);
			}

			return client.monitors.create(payload as any);
		},
		onSuccess: () => {
			sileo.success({
				title: monitorId ? "Monitor updated" : "Monitor created",
			});
			utils.invalidateQueries({ queryKey: orpc.monitors.list.key() });
			if (monitorId) {
				utils.invalidateQueries({
					queryKey: orpc.monitors.get.key({ input: { id: monitorId } }),
				});
			}
			router.push("/monitors");
		},
		onError: (error) => {
			sileo.error({
				title:
					error.message ||
					(monitorId ? "Failed to update monitor" : "Failed to create monitor"),
			});
			console.error(error);
		},
	});

	const submitForm = (values: FormValues) => {
		mutate(values);
	};

	const handleDiscard = () => {
		form.reset(getFormValuesFromInitialData());
	};

	const handleSave = () => {
		void form.handleSubmit(submitForm)();
	};

	const type = form.watch("type");
	const selectedType =
		monitorTypes.find((t) => t.id === type) || monitorTypes[0];

	const locations = form.watch("locations") || [];
	const hasAnySelection = locations.length > 0;

	// State for collapsible continents
	const [openContinents, setOpenContinents] = useState<Record<string, boolean>>(
		{},
	);

	// Group regions by continent
	const regionsByContinent = (regions || []).reduce(
		(acc, region) => {
			const regionInfo = getRegionInfo(region);
			const continent = regionInfo.continent || "Other";
			if (!acc[continent]) {
				acc[continent] = [];
			}
			acc[continent].push(region);
			return acc;
		},
		{} as Record<string, string[]>,
	);

	const toggleContinent = (continent: string) => {
		setOpenContinents((prev) => ({
			...prev,
			[continent]: !prev[continent],
		}));
	};

	// Helper to select all regions
	const handleSelectAllRegions = () => {
		if (!regions) return;

		// If anything is selected, deselect all. Otherwise, select all.
		if (hasAnySelection) {
			form.setValue("locations", []);
		} else {
			form.setValue("locations", regions);
		}
	};

	return (
		<>
			<Form {...form}>
				<form
					onSubmit={form.handleSubmit(submitForm)}
					className="space-y-10 pb-20"
				>
					{/* ... (What to monitor Section remains same) ... */}

					{/* ... (General Settings Section updated) ... */}
					{/* Section: What to monitor */}
					<div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
						<div className="col-span-1">
							<h2 className="font-semibold text-lg leading-tight tracking-tight">
								What to monitor
							</h2>
							<p className="mt-1 text-muted-foreground text-sm">
								Select the type of monitor and enter the target details.
							</p>
						</div>

						<Card className="col-span-1 md:col-span-2">
							<CardContent className="space-y-6 p-6">
								<FormField
									control={form.control}
									name="type"
									render={({ field }) => {
										const selectedType = monitorTypes.find(
											(t) => t.id === field.value,
										);
										return (
											<FormItem className="flex flex-col">
												<FormLabel>Monitor Type</FormLabel>
												<Combobox
													items={monitorTypes}
													value={selectedType}
													onValueChange={(value) =>
														value && form.setValue("type", value.id)
													}
												>
													<ComboboxValue>
														{(value: (typeof monitorTypes)[number]) => (
															<ComboboxInput
																placeholder="Select type"
																startAddon={
																	value ? (
																		<value.icon className="h-4 w-4 text-muted-foreground" />
																	) : undefined
																}
															/>
														)}
													</ComboboxValue>
													<ComboboxPopup>
														<ComboboxEmpty>No type found.</ComboboxEmpty>
														<ComboboxList>
															{(type) => (
																<ComboboxItem key={type.id} value={type}>
																	<div className="flex items-center gap-3">
																		<type.icon className="h-4 w-4 text-muted-foreground" />
																		<div className="flex flex-col">
																			<span>{type.label}</span>
																			<span className="text-muted-foreground text-xs">
																				{type.description}
																			</span>
																		</div>
																	</div>
																</ComboboxItem>
															)}
														</ComboboxList>
													</ComboboxPopup>
												</Combobox>
												<FormMessage />
											</FormItem>
										);
									}}
								/>

								{/* Dynamic Fields based on Type */}
								{selectedType && <selectedType.Fields form={form} />}
							</CardContent>
						</Card>
					</div>

					<Separator />

					{/* Section: General Settings */}
					<div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
						<div className="col-span-1">
							<h2 className="font-semibold text-lg leading-tight tracking-tight">
								General settings
							</h2>
							<p className="mt-1 text-muted-foreground text-sm">
								Configure the display name and monitoring frequency.
							</p>
						</div>

						<Card className="col-span-1 md:col-span-2">
							<CardContent className="space-y-6 p-6">
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Display name</FormLabel>
											<FormControl>
												<Input placeholder="My Monitor" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
									<FormField
										control={form.control}
										name="groupId"
										render={({ field }) => {
											const groupOptions =
												groups?.map((g) => ({ label: g.name, value: g.id })) ||
												[];
											const selectedGroup = groupOptions.find(
												(g) => g.value === field.value,
											);
											return (
												<FormItem>
													<FormLabel>Group</FormLabel>
													<Select
														onValueChange={(val) => field.onChange(val || null)}
														value={field.value || ""}
													>
														<FormControl>
															<SelectTrigger className="w-full">
																<SelectValue placeholder="Select group">
																	{selectedGroup?.label}
																</SelectValue>
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															{groupOptions.map(({ label, value }) => (
																<SelectItem key={value} value={value}>
																	{label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
													<FormMessage />
												</FormItem>
											);
										}}
									/>

									<FormField
										control={form.control}
										name="tags"
										render={({ field }) => {
											const selectedTags = (tags || []).filter((tag) =>
												field.value?.includes(tag.id),
											);
											return (
												<FormItem>
													<FormLabel>Tags</FormLabel>
													<Combobox
														items={tags || []}
														value={selectedTags}
														onValueChange={(newValue) =>
															field.onChange(newValue.map((t) => t.id))
														}
														multiple
													>
														<ComboboxChips>
															<ComboboxValue>
																{(value: typeof tags) => (
																	<>
																		{value?.map((tag) => (
																			<ComboboxChip
																				key={tag.id}
																				aria-label={tag.name}
																				style={{
																					backgroundColor: `${tag.color}20`,
																					color: tag.color,
																				}}
																			>
																				{tag.name}
																			</ComboboxChip>
																		))}
																		<ComboboxChipsInput
																			aria-label="Select tags"
																			placeholder={
																				value && value.length > 0
																					? undefined
																					: "Select tags"
																			}
																		/>
																	</>
																)}
															</ComboboxValue>
														</ComboboxChips>
														<ComboboxPopup>
															<ComboboxEmpty>No tags found.</ComboboxEmpty>
															<ComboboxList>
																{(tag) => (
																	<ComboboxItem key={tag.id} value={tag}>
																		<div className="flex items-center gap-2">
																			<div
																				className="h-2 w-2 rounded-full"
																				style={{ backgroundColor: tag.color }}
																			/>
																			{tag.name}
																		</div>
																	</ComboboxItem>
																)}
															</ComboboxList>
														</ComboboxPopup>
													</Combobox>
													<div className="flex items-center gap-2">
														<Button
															type="button"
															variant="outline"
															size="sm"
															onClick={() => setTagsOpen(true)}
														>
															New tag
														</Button>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															onClick={() => setManageTagsOpen(true)}
														>
															Edit tags
														</Button>
													</div>
													<FormMessage />
												</FormItem>
											);
										}}
									/>
								</div>

								<FormField
									control={form.control}
									name="interval"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Heartbeat period</FormLabel>
											<Select
												onValueChange={(val) => field.onChange(Number(val))}
												defaultValue={field.value.toString()}
											>
												<FormControl>
													<SelectTrigger className="w-full">
														<SelectValue placeholder="Select interval" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													<SelectItem value="60">1 minute</SelectItem>
													<SelectItem value="120">2 minutes</SelectItem>
													<SelectItem value="300">5 minutes</SelectItem>
													<SelectItem value="600">10 minutes</SelectItem>
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>

								{/* New Regions Field */}
								<FormField
									control={form.control}
									name="locations"
									render={({ field }) => (
										<FormItem>
											<FormLabel className="flex items-center justify-between">
												Regions
												<Button
													type="button"
													variant="link"
													className="h-auto p-0 text-xs"
													onClick={handleSelectAllRegions}
												>
													{hasAnySelection ? "Deselect all" : "Select all"}
												</Button>
											</FormLabel>
											<div className="space-y-2">
												{Object.entries(regionsByContinent)
													.sort(([a], [b]) => a.localeCompare(b))
													.map(([continent, continentRegions]) => (
														<Collapsible
															key={continent}
															open={openContinents[continent]}
															onOpenChange={() => toggleContinent(continent)}
														>
															<CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-muted/30 px-4 py-2 font-semibold text-sm hover:bg-muted/50">
																<span>{continent}</span>
																<ChevronRight
																	className={cn(
																		"h-4 w-4 transition-transform duration-200",
																		openContinents[continent] && "rotate-90",
																	)}
																/>
															</CollapsibleTrigger>
															<CollapsibleContent>
																<div className="grid grid-cols-2 gap-2 pt-2">
																	{continentRegions.map((region) => {
																		const regionInfo = getRegionInfo(region);
																		const Flag = regionInfo.Flag;

																		return (
																			<FormField
																				key={region}
																				control={form.control}
																				name="locations"
																				render={({ field }) => {
																					return (
																						<FormItem
																							key={region}
																							className="flex flex-row items-start space-x-3 space-y-0 rounded-md bg-muted/50 p-4"
																						>
																							<FormControl>
																								<Checkbox
																									checked={field.value?.includes(
																										region,
																									)}
																									onCheckedChange={(
																										checked,
																									) => {
																										return checked
																											? field.onChange([
																													...field.value,
																													region,
																												])
																											: field.onChange(
																													field.value?.filter(
																														(value) =>
																															value !== region,
																													),
																												);
																									}}
																								/>
																							</FormControl>
																							<div className="flex items-center gap-2 space-y-1 leading-none">
																								<div className="relative h-3.5 w-5 overflow-hidden rounded-[2px] shadow-sm">
																									<Flag className="h-full w-full object-cover" />
																								</div>
																								<FormLabel className="cursor-pointer font-normal">
																									{regionInfo.label}
																								</FormLabel>
																							</div>
																						</FormItem>
																					);
																				}}
																			/>
																		);
																	})}
																</div>
															</CollapsibleContent>
														</Collapsible>
													))}
											</div>
											<FormMessage />
										</FormItem>
									)}
								/>
							</CardContent>
						</Card>
					</div>

					{/* Section: Advanced Settings */}
					<Collapsible
						open={isAdvancedOpen}
						onOpenChange={setIsAdvancedOpen}
						className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3"
					>
						<div className="col-span-1">
							<CollapsibleTrigger
								render={
									<Button
										variant="ghost"
										className="flex items-center gap-2 pl-0 font-semibold text-lg leading-tight tracking-tight hover:bg-transparent"
									>
										<ChevronRight
											className={cn(
												"h-4 w-4 transition-transform",
												isAdvancedOpen && "rotate-90",
											)}
										/>
										Advanced settings
									</Button>
								}
							/>
							{isAdvancedOpen && (
								<p className="mt-1 text-muted-foreground text-sm">
									Detailed configurations for requests, timeouts, and headers.
								</p>
							)}
						</div>

						<CollapsibleContent className="col-span-1 md:col-span-2">
							<Card>
								<CardContent className="space-y-6 p-6">
									<div className="grid gap-6 md:grid-cols-2">
										<FormField
											control={form.control}
											name="incidentPendingDuration"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Confirmation period (Pending)</FormLabel>
													<Select
														onValueChange={(val) => field.onChange(Number(val))}
														defaultValue={field.value.toString()}
													>
														<FormControl>
															<SelectTrigger className="w-full">
																<SelectValue placeholder="Select duration" />
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															<SelectItem value="0">Immediate</SelectItem>
															<SelectItem value="60">1 minute</SelectItem>
															<SelectItem value="120">2 minutes</SelectItem>
															<SelectItem value="180">3 minutes</SelectItem>
															<SelectItem value="300">5 minutes</SelectItem>
															<SelectItem value="600">10 minutes</SelectItem>
														</SelectContent>
													</Select>
													<FormDescription>
														How long to wait before alerting.
													</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="incidentRecoveryDuration"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Recovery period</FormLabel>
													<Select
														onValueChange={(val) => field.onChange(Number(val))}
														defaultValue={field.value.toString()}
													>
														<FormControl>
															<SelectTrigger className="w-full">
																<SelectValue placeholder="Select duration" />
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															<SelectItem value="0">Immediate</SelectItem>
															<SelectItem value="60">1 minute</SelectItem>
															<SelectItem value="120">2 minutes</SelectItem>
															<SelectItem value="300">5 minutes</SelectItem>
														</SelectContent>
													</Select>
													<FormDescription>
														How long it must be up to resolve.
													</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>

									<FormField
										control={form.control}
										name="publishIncidentToStatusPage"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg bg-muted/50 p-4">
												<div className="space-y-0.5">
													<FormLabel className="text-base">
														Publish incidents to status pages
													</FormLabel>
													<FormDescription>
														When this monitor opens an automatic incident,
														publish it to every status page that already
														includes this monitor.
													</FormDescription>
												</div>
												<FormControl>
													<Checkbox
														checked={field.value}
														onCheckedChange={(checked) =>
															field.onChange(checked === true)
														}
													/>
												</FormControl>
											</FormItem>
										)}
									/>

									{["http", "http-json", "keyword"].includes(
										selectedType.id,
									) && <HttpAdvancedFields form={form} />}
								</CardContent>
							</Card>
						</CollapsibleContent>
					</Collapsible>

					<div className="sticky bottom-0 z-10 flex justify-end gap-4 border-t bg-background/80 p-4 backdrop-blur-sm">
						<Button
							type="button"
							variant="outline"
							onClick={handleDiscard}
							disabled={isPending}
						>
							Discard
						</Button>
						<Button type="button" onClick={handleSave} disabled={isPending}>
							{isPending
								? monitorId
									? "Updating..."
									: "Creating..."
								: monitorId
									? "Update Monitor"
									: "Create Monitor"}
						</Button>
					</div>
				</form>
			</Form>
			<GroupCreationDialog open={groupsOpen} onOpenChange={setGroupsOpen} />
			<TagCreationDialog open={tagsOpen} onOpenChange={setTagsOpen} />
			<Dialog open={manageTagsOpen} onOpenChange={setManageTagsOpen}>
				<DialogContent className="sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>Manage Tags</DialogTitle>
						<DialogDescription>
							Create, edit, and delete monitor tags without leaving this
							form.
						</DialogDescription>
					</DialogHeader>
					<TagsManager />
				</DialogContent>
			</Dialog>
		</>
	);
}
