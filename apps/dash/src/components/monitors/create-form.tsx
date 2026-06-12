"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	monitorTimingDefaults,
	monitorTimingSchema,
	withMonitorTimingRelations,
} from "@uptimekit/api/lib/monitor-timing";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
	type UseFormReturn,
	useFieldArray,
	useForm,
	useWatch,
} from "react-hook-form";
import { sileo } from "sileo";
import * as z from "zod";
import {
	Activity,
	Bell,
	Braces,
	ChevronRight,
	Globe,
	Network,
	Plus,
	Search,
	Server,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
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
	ComboboxSeparator,
	ComboboxValue,
} from "@/components/ui/combobox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectGroupLabel,
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
import {
	buildGroupPaths,
	NO_GROUP_LABEL,
	NONE_SELECT_VALUE,
	resolveGroupPathLabel,
} from "./group-tree";
import { GroupsManager } from "./groups-manager";
import { TagCreationDialog } from "./tag-creation-dialog";
import { TagsManager } from "./tags-manager";

// --- Configuration Registry ---

const CREATE_GROUP_SELECT_VALUE = "__create_group__";

const baseSchema = withMonitorTimingRelations(
	z.object({
		name: z.string().min(1, "Name is required"),
		...monitorTimingSchema,
		groupId: z.string().nullish(),
		tags: z.array(z.string()).default([]),
		notificationIds: z.array(z.string()).default([]),
		incidentPendingDuration: z.coerce.number().default(0),
		incidentRecoveryDuration: z.coerce.number().default(0),
		publishIncidentToStatusPage: z.boolean().default(false),
		workerIds: z.array(z.string()),
	}),
);

const httpUrlSchema = z
	.string()
	.url("Must be a valid URL")
	.refine((value) => {
		try {
			const url = new URL(value);
			return url.protocol === "http:" || url.protocol === "https:";
		} catch {
			return false;
		}
	}, "URL must start with http:// or https://");

const httpSchema = z.object({
	type: z.literal("http"),
	url: httpUrlSchema,
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
	url: httpUrlSchema,
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
	url: httpUrlSchema,
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

const instatusSchema = z.object({
	type: z.literal("instatus"),
	url: z.url(),
	componentId: z.string().min(1, "Select a status component"),
	hostname: z.string().min(1, "Select a status component"),
});

const dnsRecordTypes = [
	"A",
	"AAAA",
	"CNAME",
	"MX",
	"NS",
	"TXT",
	"SRV",
	"CAA",
	"PTR",
	"SOA",
] as const;

const dnsSchema = z.object({
	type: z.literal("dns"),
	hostname: z.string().min(1, "Hostname is required"),
	resolverServers: z.string().default("1.1.1.1"),
	port: z.coerce.number().min(1).max(65535).default(53),
	recordType: z.enum(dnsRecordTypes).default("A"),
	expectedValue: z.string().optional(),
});

// Union schema
const monitorConfigSchema = z.discriminatedUnion("type", [
	httpSchema,
	httpJsonSchema,
	keywordSchema,
	pingSchema,
	tcpSchema,
	dnsSchema,
	instatusSchema,
]);

const formSchema = z
	.intersection(baseSchema, monitorConfigSchema)
	.refine(
		(values) => values.type === "instatus" || values.workerIds.length > 0,
		{
			message: "At least one worker must be selected",
			path: ["workerIds"],
		},
	);

type FormValues = z.infer<typeof formSchema>;
interface ActiveWorkerOption {
	id: string;
	name: string;
	location: string;
}

interface ExternalComponentOption {
	id: string;
	name: string;
	description: string;
	status: string;
	group: {
		id: string;
		name: string;
		description: string;
	} | null;
}

interface ConfiguredNotification {
	id: string;
	name: string;
	type: string;
	active: boolean;
	isDefault: boolean;
}

const formatSeconds = (seconds: number) => {
	if (!Number.isFinite(seconds)) {
		return "";
	}

	if (seconds >= 60 && seconds % 60 === 0) {
		const minutes = seconds / 60;
		return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
	}

	return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
};

const confirmationPeriodOptions = [
	{ label: "Immediate", value: "0" },
	{ label: "1 minute", value: "60" },
	{ label: "2 minutes", value: "120" },
	{ label: "3 minutes", value: "180" },
	{ label: "5 minutes", value: "300" },
	{ label: "10 minutes", value: "600" },
] as const;

const recoveryPeriodOptions = [
	{ label: "Immediate", value: "0" },
	{ label: "1 minute", value: "60" },
	{ label: "2 minutes", value: "120" },
	{ label: "5 minutes", value: "300" },
] as const;

// Registry for UI components and metadata
interface MonitorTypeDefinition {
	id: FormValues["type"];
	label: string;
	description: string;
	icon: React.ElementType;
	group: "Network & web" | "Infrastructure" | "External";
	// Component to render specific fields
	Fields: React.ComponentType<{ form: UseFormReturn<FormValues> }>;
}

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

const DnsFields = ({ form }: { form: UseFormReturn<FormValues> }) => (
	<div className="flex flex-col gap-4">
		<HostnameField form={form} />

		<FormField
			control={form.control}
			name="resolverServers"
			render={({ field }) => (
				<FormItem>
					<FormLabel>Resolver server(s)</FormLabel>
					<FormControl>
						<Input placeholder="1.1.1.1" {...field} />
					</FormControl>
					<FormDescription>
						Comma-delimited DNS resolvers. Cloudflare is used by default.
					</FormDescription>
					<FormMessage />
				</FormItem>
			)}
		/>

		<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
			<FormField
				control={form.control}
				name="port"
				render={({ field }) => (
					<FormItem>
						<FormLabel>Port</FormLabel>
						<FormControl>
							<Input
								placeholder="53"
								type="number"
								min={1}
								max={65535}
								{...field}
							/>
						</FormControl>
						<FormDescription>DNS server port. Defaults to 53.</FormDescription>
						<FormMessage />
					</FormItem>
				)}
			/>

			<FormField
				control={form.control}
				name="recordType"
				render={({ field }) => {
					const selectedRecordType = dnsRecordTypes.find(
						(recordType) => recordType === field.value,
					);

					return (
						<FormItem>
							<FormLabel>Resource record type</FormLabel>
							<Select onValueChange={field.onChange} value={field.value}>
								<FormControl>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Select record type">
											{selectedRecordType}
										</SelectValue>
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									<SelectGroup>
										{dnsRecordTypes.map((recordType) => (
											<SelectItem key={recordType} value={recordType}>
												{recordType}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
							<FormDescription>
								Select the DNS record type to monitor.
							</FormDescription>
							<FormMessage />
						</FormItem>
					);
				}}
			/>
		</div>

		<FormField
			control={form.control}
			name="expectedValue"
			render={({ field }) => (
				<FormItem>
					<FormLabel>Expected answer</FormLabel>
					<FormControl>
						<Input placeholder="192.0.2.1" {...field} />
					</FormControl>
					<FormDescription>
						Optional answer value that must be present in the DNS response.
					</FormDescription>
					<FormMessage />
				</FormItem>
			)}
		/>
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

function getComponentGroupName(component: ExternalComponentOption) {
	return component.group?.name ?? "Ungrouped";
}

function groupExternalComponents(components: ExternalComponentOption[]) {
	return Object.entries(
		components.reduce(
			(acc, component) => {
				const groupName = getComponentGroupName(component);
				acc[groupName] = [...(acc[groupName] ?? []), component];
				return acc;
			},
			{} as Record<string, ExternalComponentOption[]>,
		),
	)
		.map(
			([groupName, items]) =>
				[
					groupName,
					[...items].sort(
						(a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
					),
				] as const,
		)
		.sort(([groupA], [groupB]) => {
			if (groupA === "Ungrouped") return 1;
			if (groupB === "Ungrouped") return -1;
			return groupA.localeCompare(groupB);
		});
}

function getExternalStatusBadgeVariant(status: string) {
	const normalized = status.trim().toUpperCase();
	if (normalized === "OPERATIONAL") return "success";
	if (normalized.includes("MAINTENANCE")) return "info";
	if (normalized.includes("DEGRADED")) return "warning";
	if (normalized.includes("OUTAGE") || normalized === "DOWN") return "error";
	return "outline";
}

function formatExternalStatus(status: string) {
	return status
		.toLowerCase()
		.split(/[_\s-]+/)
		.filter(Boolean)
		.map((part) => part[0]?.toUpperCase() + part.slice(1))
		.join(" ");
}

function formatShortComponentId(id: string) {
	return id.length > 12 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

function isHttpStatusPageUrl(value: unknown) {
	if (typeof value !== "string") {
		return false;
	}

	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}

const InstatusFields = ({ form }: { form: UseFormReturn<FormValues> }) => {
	const statusPageUrl =
		(useWatch({
			control: form.control,
			name: "url" as any,
		}) as string | undefined) ?? "";
	const trimmedStatusPageUrl = statusPageUrl.trim();
	const canLoadComponents = isHttpStatusPageUrl(trimmedStatusPageUrl);
	const [componentsRequestedUrl, setComponentsRequestedUrl] = useState<
		string | null
	>(null);
	const previousStatusPageUrlRef = useRef<string | null>(null);
	const { data, isLoading, error } = useQuery({
		...orpc.monitors.listExternalComponents.queryOptions({
			input: {
				type: "instatus",
				url: trimmedStatusPageUrl || "https://example.com",
			},
		}),
		enabled:
			canLoadComponents && componentsRequestedUrl === trimmedStatusPageUrl,
		retry: false,
		staleTime: 60_000,
	});
	const components = (data ?? []) as ExternalComponentOption[];
	const selectedComponentId = useWatch({
		control: form.control,
		name: "componentId" as any,
	}) as string | undefined;
	const selectedComponentName = useWatch({
		control: form.control,
		name: "hostname" as any,
	}) as string | undefined;
	const selectedComponent =
		components.find((component) => component.id === selectedComponentId) ??
		null;
	const selectedComponentLabel =
		selectedComponent?.name ?? selectedComponentName ?? "";
	const groupedComponents = groupExternalComponents(components);
	const componentDescription = !canLoadComponents
		? "Enter an Instatus status page URL to load components."
		: selectedComponent
			? `${selectedComponent.group?.name ? `${selectedComponent.group.name} · ` : ""}${selectedComponent.id}`
			: selectedComponentName
				? `Previously matched by name: ${selectedComponentName}. Select the exact component to avoid duplicate names.`
				: "Select the exact upstream component. The component ID is saved so duplicate names stay separate.";

	useEffect(() => {
		const previousStatusPageUrl = previousStatusPageUrlRef.current;
		previousStatusPageUrlRef.current = trimmedStatusPageUrl;

		if (
			previousStatusPageUrl === null ||
			previousStatusPageUrl === trimmedStatusPageUrl
		) {
			return;
		}

		form.setValue("componentId" as any, "", {
			shouldDirty: true,
			shouldValidate: true,
		});
		form.setValue("hostname", "", {
			shouldDirty: true,
			shouldValidate: true,
		});
		setComponentsRequestedUrl(null);
	}, [form, trimmedStatusPageUrl]);

	const handleSelectComponent = (component: ExternalComponentOption) => {
		form.setValue("componentId" as any, component.id, {
			shouldDirty: true,
			shouldValidate: true,
		});
		form.setValue("hostname", component.name, {
			shouldDirty: true,
			shouldValidate: true,
		});
	};

	return (
		<>
			<UrlField form={form} />
			<FormField
				control={form.control}
				name={"componentId" as any}
				render={({ field }) => (
					<FormItem>
						<FormLabel>Status component</FormLabel>
						<Select
							disabled={!canLoadComponents}
							onOpenChange={(open) => {
								if (open && canLoadComponents) {
									setComponentsRequestedUrl(trimmedStatusPageUrl);
								}
							}}
							onValueChange={(componentId) => {
								const component = components.find(
									(item) => item.id === componentId,
								);
								if (component) {
									handleSelectComponent(component);
								}
							}}
							value={(field.value as string | undefined) || ""}
						>
							<FormControl>
								<SelectTrigger className="w-full">
									<SelectValue
										placeholder={
											canLoadComponents
												? "Select a status component"
												: "Enter a valid Instatus URL first"
										}
									>
										{selectedComponentLabel}
									</SelectValue>
								</SelectTrigger>
							</FormControl>
							<SelectContent className="max-h-80">
								{isLoading ? (
									<div className="p-3 text-muted-foreground text-sm">
										Loading components...
									</div>
								) : error ? (
									<div className="p-3 text-destructive text-sm">
										Unable to load components.
									</div>
								) : groupedComponents.length === 0 ? (
									<div className="p-3 text-muted-foreground text-sm">
										No components found.
									</div>
								) : (
									groupedComponents.map(([groupName, groupComponents]) => (
										<SelectGroup key={groupName}>
											<SelectGroupLabel>{groupName}</SelectGroupLabel>
											{groupComponents.map((component) => (
												<SelectItem key={component.id} value={component.id}>
													<div className="min-w-0 space-y-1">
														<div className="flex min-w-0 flex-wrap items-center gap-2">
															<span className="truncate font-medium">
																{component.name}
															</span>
															<Badge
																size="sm"
																variant={getExternalStatusBadgeVariant(
																	component.status,
																)}
															>
																{formatExternalStatus(component.status)}
															</Badge>
														</div>
														<div className="truncate text-muted-foreground text-xs">
															{formatShortComponentId(component.id)}
														</div>
													</div>
												</SelectItem>
											))}
										</SelectGroup>
									))
								)}
							</SelectContent>
						</Select>
						<FormDescription>{componentDescription}</FormDescription>
						<FormMessage />
					</FormItem>
				)}
			/>
		</>
	);
};

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
	{
		id: "dns",
		group: "Infrastructure",
		label: "DNS",
		description: "Query DNS records through a resolver",
		icon: Network,
		Fields: DnsFields,
	},
	{
		id: "instatus",
		group: "External",
		label: "Instatus",
		description: "Get the monitor from any Instatus status page",
		icon: Network,
		Fields: InstatusFields,
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

const TimingNumberField = ({
	form,
	name,
	label,
	description,
	min,
	max,
}: {
	form: UseFormReturn<FormValues>;
	name: "interval" | "timeout" | "retries" | "retryInterval";
	label: (value: number) => string;
	description?: (value: number) => string;
	min: number;
	max?: number;
}) => (
	<FormField
		control={form.control}
		name={name}
		render={({ field }) => {
			const value = Number(field.value);

			return (
				<FormItem>
					<FormLabel>{label(value)}</FormLabel>
					<FormControl>
						<Input
							type="number"
							min={min}
							max={max}
							step={1}
							value={Number.isFinite(value) ? value : ""}
							onChange={(event) => field.onChange(Number(event.target.value))}
							onBlur={field.onBlur}
							name={field.name}
							ref={field.ref}
						/>
					</FormControl>
					{description && (
						<FormDescription>{description(value)}</FormDescription>
					)}
					<FormMessage />
				</FormItem>
			);
		}}
	/>
);

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
	const { data: workers } = useQuery(orpc.workers.listActive.queryOptions());
	const { data: organizationQuota } = useQuery(
		orpc.organizations.getActiveQuota.queryOptions(),
	);
	const { data: groups } = useQuery(orpc.monitors.listGroups.queryOptions());
	const { data: tags } = useQuery(orpc.monitors.listTags.queryOptions());
	const { data: configuredNotifications } = useQuery({
		queryKey: ["integrations", "configured"],
		queryFn: async () =>
			(await client.integrations.listConfigured()) as ConfiguredNotification[],
	});

	const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
	const [groupsOpen, setGroupsOpen] = useState(false);
	const [manageGroupsOpen, setManageGroupsOpen] = useState(false);
	const [tagsOpen, setTagsOpen] = useState(false);
	const [manageTagsOpen, setManageTagsOpen] = useState(false);
	const [defaultNotificationsApplied, setDefaultNotificationsApplied] =
		useState(false);

	const getFormValuesFromInitialData = (): FormValues => {
		const defaults = (initialData as any) || {};
		return {
			name: defaults.name || "",
			type: defaults.type || "http",
			interval: defaults.interval ?? monitorTimingDefaults.interval,
			timeout: defaults.timeout ?? monitorTimingDefaults.timeout,
			retries: defaults.retries ?? monitorTimingDefaults.retries,
			retryInterval:
				defaults.retryInterval ?? monitorTimingDefaults.retryInterval,
			groupId: defaults.groupId ?? null,
			tags:
				defaults.tags?.map((t: any) => (typeof t === "string" ? t : t.id)) ||
				[],
			notificationIds:
				defaults.notificationIds ||
				defaults.notifications?.map((notification: any) => notification.id) ||
				[],
			checkSsl: defaults.checkSsl ?? true,
			sslCertExpiryNotificationDays:
				defaults.sslCertExpiryNotificationDays || 30,
			incidentPendingDuration: defaults.incidentPendingDuration || 0,
			incidentRecoveryDuration: defaults.incidentRecoveryDuration || 0,
			publishIncidentToStatusPage:
				defaults.publishIncidentToStatusPage ?? false,
			workerIds: defaults.workerIds || [],
			method: defaults.method || "GET",
			url: defaults.url || "",
			componentId: defaults.componentId || "",
			hostname: defaults.hostname || "",
			port: defaults.port || (defaults.type === "dns" ? 53 : 80),
			resolverServers: defaults.resolverServers || "1.1.1.1",
			recordType: defaults.recordType || "A",
			expectedValue: defaults.expectedValue || "",
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

	useEffect(() => {
		if (monitorId || defaultNotificationsApplied || !configuredNotifications) {
			return;
		}

		form.setValue(
			"notificationIds",
			configuredNotifications
				.filter((notification) => notification.isDefault)
				.map((notification) => notification.id),
		);
		setDefaultNotificationsApplied(true);
	}, [configuredNotifications, defaultNotificationsApplied, form, monitorId]);

	const { mutate, isPending } = useMutation({
		mutationFn: async (data: FormValues) => {
			// Transform form data to match API expectation
			const {
				type,
				name,
				interval,
				timeout,
				retries,
				retryInterval,
				groupId,
				tags,
				workerIds,
				notificationIds,
				incidentPendingDuration,
				incidentRecoveryDuration,
				publishIncidentToStatusPage,
				...rest
			} = data;

			const payload = {
				type,
				name,
				interval,
				timeout,
				retries,
				retryInterval,
				groupId,
				tags,
				workerIds,
				...(monitorId || configuredNotifications !== undefined
					? { notificationIds }
					: {}),
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
				router.push(`/monitors/${monitorId}`);
				utils.invalidateQueries({
					queryKey: orpc.monitors.get.key({ input: { id: monitorId } }),
				});
			}
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
		if (!monitorId) {
			router.push("/monitors");
			return;
		}

		form.reset(getFormValuesFromInitialData());
	};

	const handleSave = () => {
		void form.handleSubmit(submitForm)();
	};

	const handleMonitorTypeChange = (nextType: FormValues["type"]) => {
		const previousType = form.getValues("type");
		form.setValue("type", nextType);

		if (nextType === "dns" && previousType !== "dns") {
			form.setValue("port", 53);
			form.setValue("resolverServers", "1.1.1.1");
			form.setValue("recordType", "A");
			form.setValue("expectedValue", "");
			return;
		}

		if (nextType === "tcp" && previousType !== "tcp") {
			form.setValue("port", 80);
		}
	};

	const type = form.watch("type");
	const heartbeatInterval = form.watch("interval");
	const selectedType =
		monitorTypes.find((t) => t.id === type) || monitorTypes[0];

	useEffect(() => {
		const retryInterval = form.getValues("retryInterval");
		if (
			Number.isFinite(heartbeatInterval) &&
			Number.isFinite(retryInterval) &&
			retryInterval > heartbeatInterval
		) {
			form.setValue("retryInterval", heartbeatInterval, {
				shouldValidate: true,
			});
		}
	}, [heartbeatInterval, form]);

	const workerIds = form.watch("workerIds") || [];
	const hasAnySelection = workerIds.length > 0;
	const regionLimit = organizationQuota?.regionsPerMonitorLimit ?? null;
	const activeMonitorLimit = organizationQuota?.activeMonitorLimit ?? null;
	const selectedRegionCount = workerIds.length;
	const isOverRegionLimit =
		regionLimit !== null && selectedRegionCount > regionLimit;
	const selectedNotificationIds = form.watch("notificationIds") || [];

	// State for collapsible continents
	const [openContinents, setOpenContinents] = useState<Record<string, boolean>>(
		{},
	);

	const workersByContinent = ((workers || []) as ActiveWorkerOption[]).reduce(
		(acc, activeWorker) => {
			const regionInfo = getRegionInfo(activeWorker.location);
			const continent = regionInfo.continent || "Other";
			if (!acc[continent]) {
				acc[continent] = [];
			}
			acc[continent].push(activeWorker);
			return acc;
		},
		{} as Record<string, ActiveWorkerOption[]>,
	);

	const toggleContinent = (continent: string) => {
		setOpenContinents((prev) => ({
			...prev,
			[continent]: !prev[continent],
		}));
	};

	const handleSelectAllWorkers = () => {
		if (!workers) return;

		if (hasAnySelection) {
			form.setValue("workerIds", []);
		} else {
			form.setValue(
				"workerIds",
				workers.map((activeWorker) => activeWorker.id),
			);
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
														value && handleMonitorTypeChange(value.id)
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
											const groupOptions = buildGroupPaths(groups);
											return (
												<FormItem>
													<FormLabel>Group</FormLabel>
													<Select
														onValueChange={(val) => {
															if (val === CREATE_GROUP_SELECT_VALUE) {
																setGroupsOpen(true);
																return;
															}

															field.onChange(
																val === NONE_SELECT_VALUE ? null : val,
															);
														}}
														value={field.value || NONE_SELECT_VALUE}
													>
														<FormControl>
															<SelectTrigger className="w-full">
																<SelectValue placeholder={NO_GROUP_LABEL}>
																	{(value) =>
																		resolveGroupPathLabel(
																			value as string,
																			groupOptions,
																			NO_GROUP_LABEL,
																		)
																	}
																</SelectValue>
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															<SelectItem value={NONE_SELECT_VALUE}>
																{NO_GROUP_LABEL}
															</SelectItem>
															{groupOptions.map(({ group, path, depth }) => (
																<SelectItem key={group.id} value={group.id}>
																	<span style={{ paddingLeft: depth * 12 }}>
																		{path}
																	</span>
																</SelectItem>
															))}
															<div className="my-1 border-t" />
															<SelectItem value={CREATE_GROUP_SELECT_VALUE}>
																<span className="flex items-center gap-2 text-muted-foreground">
																	<Plus className="h-4 w-4" />
																	<span>Create group</span>
																</span>
															</SelectItem>
														</SelectContent>
													</Select>
													<div className="flex items-center gap-2">
														<Button
															type="button"
															variant="ghost"
															size="sm"
															onClick={() => setManageGroupsOpen(true)}
														>
															Edit groups
														</Button>
													</div>
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
											type TagOption = NonNullable<typeof tags>[number];

											return (
												<FormItem>
													<FormLabel>Tags</FormLabel>
													<Combobox
														items={tags || []}
														value={selectedTags}
														onValueChange={(newValue) => {
															const values = newValue as Array<
																TagOption | "create_tag"
															>;

															if (values.includes("create_tag")) {
																setTagsOpen(true);
																return;
															}

															const tagValues = values.filter(
																(tag): tag is TagOption => tag !== "create_tag",
															);

															field.onChange(tagValues.map((tag) => tag.id));
														}}
														multiple
													>
														<ComboboxChips>
															<ComboboxValue>
																{(value: typeof selectedTags) => (
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
																{(tags || []).map((tag) => (
																	<ComboboxItem key={tag.id} value={tag}>
																		<div className="flex items-center gap-2">
																			<div
																				className="h-2 w-2 rounded-full"
																				style={{ backgroundColor: tag.color }}
																			/>
																			{tag.name}
																		</div>
																	</ComboboxItem>
																))}

																<ComboboxSeparator />

																<ComboboxItem
																	key="create_tag"
																	value="create_tag"
																	className="hover:bg-muted"
																>
																	<div className="flex items-center gap-2 text-muted-foreground">
																		<Plus className="h-4 w-4" />
																		<span>Create tag</span>
																	</div>
																</ComboboxItem>
															</ComboboxList>
														</ComboboxPopup>
													</Combobox>
													<div className="flex items-center gap-2">
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
								{!(selectedType.id === "instatus") ? (
									<>
										<TimingNumberField
											form={form}
											name="interval"
											min={10}
											label={(value) =>
												`Heartbeat Interval (Check every ${formatSeconds(value)})`
											}
											description={(value) => formatSeconds(value)}
										/>

										{/* Workers Field */}
										<FormField
											control={form.control}
											name="workerIds"
											render={() => (
												<FormItem>
													<FormLabel className="flex items-center justify-between">
														Workers
														<Button
															type="button"
															variant="link"
															className="h-auto p-0 text-xs"
															onClick={handleSelectAllWorkers}
														>
															{hasAnySelection ? "Deselect all" : "Select all"}
														</Button>
													</FormLabel>
													<div className="rounded-lg border bg-muted/20 p-3 text-sm">
														<div className="flex flex-wrap items-center gap-x-4 gap-y-1">
															<span className="font-medium">
																Active monitors:{" "}
																{organizationQuota?.activeMonitorCount ?? 0}
																{activeMonitorLimit === null
																	? " / unlimited"
																	: ` / ${activeMonitorLimit}`}
															</span>
															<span className="text-muted-foreground">
																Selected workers: {selectedRegionCount}
																{regionLimit === null
																	? " / unlimited"
																	: ` / ${regionLimit}`}
															</span>
														</div>
														{isOverRegionLimit && (
															<p className="mt-2 text-destructive text-xs">
																This organization allows at most {regionLimit}{" "}
																worker(s) per monitor.
															</p>
														)}
													</div>
													<div className="space-y-2">
														{Object.entries(workersByContinent)
															.sort(([a], [b]) => a.localeCompare(b))
															.map(([continent, continentWorkers]) => (
																<Collapsible
																	key={continent}
																	open={openContinents[continent]}
																	onOpenChange={() =>
																		toggleContinent(continent)
																	}
																>
																	<CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-muted/30 px-4 py-2 font-semibold text-sm hover:bg-muted/50">
																		<span>{continent}</span>
																		<ChevronRight
																			className={cn(
																				"h-4 w-4 transition-transform duration-200",
																				openContinents[continent] &&
																					"rotate-90",
																			)}
																		/>
																	</CollapsibleTrigger>
																	<CollapsibleContent>
																		<div className="grid grid-cols-2 gap-2 pt-2">
																			{continentWorkers?.map((activeWorker) => {
																				const regionInfo = getRegionInfo(
																					activeWorker.location,
																				);
																				const Flag = regionInfo.Flag;

																				return (
																					<FormField
																						key={activeWorker.id}
																						control={form.control}
																						name="workerIds"
																						render={({ field }) => {
																							return (
																								<FormItem
																									key={activeWorker.id}
																									className="flex flex-row items-start space-x-3 space-y-0 rounded-md bg-muted/50 p-4"
																								>
																									<FormControl>
																										<Checkbox
																											checked={field.value?.includes(
																												activeWorker.id,
																											)}
																											onCheckedChange={(
																												checked,
																											) => {
																												return checked
																													? field.onChange([
																															...field.value,
																															activeWorker.id,
																														])
																													: field.onChange(
																															field.value?.filter(
																																(value) =>
																																	value !==
																																	activeWorker.id,
																															),
																														);
																											}}
																										/>
																									</FormControl>
																									<div className="flex items-center gap-2 space-y-1 leading-none">
																										<div className="relative size-6 overflow-hidden shadow-sm">
																											<Flag className="h-full w-full" />
																										</div>
																										<div className="min-w-0">
																											<FormLabel className="cursor-pointer font-normal">
																												{activeWorker.name}
																											</FormLabel>
																											<p className="truncate text-muted-foreground text-xs">
																												{regionInfo.label}
																											</p>
																										</div>
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
									</>
								) : (
									""
								)}
							</CardContent>
						</Card>
					</div>

					{!(selectedType.id === "instatus") ? (
						<>
							<Separator />

							{/* Section: Notifications */}
							<div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
								<div className="col-span-1">
									<h2 className="font-semibold text-lg leading-tight tracking-tight">
										Notifications
									</h2>
									<p className="mt-1 text-muted-foreground text-sm">
										Choose which notification channels should receive this
										monitor&apos;s incident events.
									</p>
								</div>

								<Card className="col-span-1 md:col-span-2">
									<CardContent className="flex flex-col gap-4 p-6">
										<FormField
											control={form.control}
											name="notificationIds"
											render={({ field }) => (
												<FormItem>
													<div className="flex items-center justify-between gap-4">
														<FormLabel>
															Selected notifications (
															{selectedNotificationIds.length})
														</FormLabel>
														{configuredNotifications &&
															configuredNotifications.length > 0 && (
																<Button
																	type="button"
																	variant="link"
																	className="h-auto p-0 text-xs"
																	onClick={() => {
																		if (field.value?.length) {
																			field.onChange([]);
																			return;
																		}

																		field.onChange(
																			configuredNotifications.map(
																				(notification) => notification.id,
																			),
																		);
																	}}
																>
																	{field.value?.length
																		? "Deselect all"
																		: "Select all"}
																</Button>
															)}
													</div>

													{configuredNotifications &&
													configuredNotifications.length > 0 ? (
														<div className="grid grid-cols-1 gap-2">
															{configuredNotifications.map((notification) => {
																const checked = field.value?.includes(
																	notification.id,
																);

																return (
																	<FormItem
																		key={notification.id}
																		className="flex flex-row items-start gap-3 rounded-md bg-muted/50 p-4"
																	>
																		<FormControl>
																			<Checkbox
																				checked={checked}
																				onCheckedChange={(nextChecked) => {
																					if (nextChecked) {
																						field.onChange([
																							...(field.value || []),
																							notification.id,
																						]);
																						return;
																					}

																					field.onChange(
																						field.value?.filter(
																							(value) =>
																								value !== notification.id,
																						) || [],
																					);
																				}}
																			/>
																		</FormControl>
																		<div className="flex min-w-0 flex-1 flex-col gap-2">
																			<div className="flex flex-wrap items-center gap-2">
																				<FormLabel className="cursor-pointer font-normal">
																					{notification.name}
																				</FormLabel>
																				<Badge variant="outline">
																					{notification.type}
																				</Badge>
																				{notification.isDefault && (
																					<Badge variant="warning">
																						Default
																					</Badge>
																				)}
																				{notification.active ? (
																					<Badge variant="success">
																						Active
																					</Badge>
																				) : (
																					<Badge variant="secondary">
																						Inactive
																					</Badge>
																				)}
																			</div>
																		</div>
																	</FormItem>
																);
															})}
														</div>
													) : (
														<div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
															<div className="flex items-center gap-2 font-medium">
																<Bell className="h-4 w-4" />
																No notifications configured
															</div>
															<p className="text-muted-foreground text-sm">
																Add a notification channel before assigning one
																to this monitor.
															</p>
															<Button
																type="button"
																variant="outline"
																onClick={() => router.push("/integrations")}
															>
																Manage notifications
															</Button>
														</div>
													)}
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
											Detailed configurations for requests, timeouts, and
											headers.
										</p>
									)}
								</div>

								<CollapsibleContent className="col-span-1 md:col-span-2">
									<Card>
										<CardContent className="space-y-6 p-6">
											<div className="grid gap-6 md:grid-cols-2">
												<TimingNumberField
													form={form}
													name="retries"
													min={0}
													max={10}
													label={() => "Retries"}
													description={() =>
														"Maximum retries before the service is marked as down and a notification is sent"
													}
												/>
												<TimingNumberField
													form={form}
													name="retryInterval"
													min={1}
													max={
														Number.isFinite(heartbeatInterval)
															? heartbeatInterval
															: 300
													}
													label={(value) =>
														`Heartbeat Retry Interval (Retry every ${formatSeconds(value)})`
													}
													description={() =>
														"Must be less than or equal to the heartbeat interval"
													}
												/>
												<TimingNumberField
													form={form}
													name="timeout"
													min={1}
													max={300}
													label={(value) =>
														`Request Timeout (Timeout after ${formatSeconds(value)})`
													}
												/>
											</div>

											<div className="grid gap-6 md:grid-cols-2">
												<FormField
													control={form.control}
													name="incidentPendingDuration"
													render={({ field }) => {
														const selectedPendingDuration =
															confirmationPeriodOptions.find(
																(option) =>
																	option.value === field.value.toString(),
															);

														return (
															<FormItem>
																<FormLabel>
																	Confirmation period (Pending)
																</FormLabel>
																<Select
																	onValueChange={(val) =>
																		field.onChange(Number(val))
																	}
																	value={field.value.toString()}
																>
																	<FormControl>
																		<SelectTrigger className="w-full">
																			<SelectValue placeholder="Select duration">
																				{selectedPendingDuration?.label}
																			</SelectValue>
																		</SelectTrigger>
																	</FormControl>
																	<SelectContent>
																		{confirmationPeriodOptions.map(
																			({ label, value }) => (
																				<SelectItem key={value} value={value}>
																					{label}
																				</SelectItem>
																			),
																		)}
																	</SelectContent>
																</Select>
																<FormDescription>
																	How long to wait before alerting.
																</FormDescription>
																<FormMessage />
															</FormItem>
														);
													}}
												/>
												<FormField
													control={form.control}
													name="incidentRecoveryDuration"
													render={({ field }) => {
														const selectedRecoveryDuration =
															recoveryPeriodOptions.find(
																(option) =>
																	option.value === field.value.toString(),
															);

														return (
															<FormItem>
																<FormLabel>Recovery period</FormLabel>
																<Select
																	onValueChange={(val) =>
																		field.onChange(Number(val))
																	}
																	value={field.value.toString()}
																>
																	<FormControl>
																		<SelectTrigger className="w-full">
																			<SelectValue placeholder="Select duration">
																				{selectedRecoveryDuration?.label}
																			</SelectValue>
																		</SelectTrigger>
																	</FormControl>
																	<SelectContent>
																		{recoveryPeriodOptions.map(
																			({ label, value }) => (
																				<SelectItem key={value} value={value}>
																					{label}
																				</SelectItem>
																			),
																		)}
																	</SelectContent>
																</Select>
																<FormDescription>
																	How long it must be up to resolve.
																</FormDescription>
																<FormMessage />
															</FormItem>
														);
													}}
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
						</>
					) : (
						""
					)}

					<div className="bottom-0 z-10 flex flex justify-end gap-4 p-4">
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
			<GroupCreationDialog
				open={groupsOpen}
				onOpenChange={setGroupsOpen}
				onCreated={(group) => form.setValue("groupId", group.id)}
			/>
			<Dialog open={manageGroupsOpen} onOpenChange={setManageGroupsOpen}>
				<DialogContent className="sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>Manage Groups</DialogTitle>
						<DialogDescription>
							Create, nest, rename, and delete monitor groups without leaving
							this form.
						</DialogDescription>
					</DialogHeader>
					<DialogPanel>
						<GroupsManager />
					</DialogPanel>
				</DialogContent>
			</Dialog>
			<TagCreationDialog open={tagsOpen} onOpenChange={setTagsOpen} />
			<Dialog open={manageTagsOpen} onOpenChange={setManageTagsOpen}>
				<DialogContent className="sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>Manage Tags</DialogTitle>
						<DialogDescription>
							Create, edit, and delete monitor tags without leaving this form.
						</DialogDescription>
					</DialogHeader>
					<DialogPanel>
						<TagsManager />
					</DialogPanel>
				</DialogContent>
			</Dialog>
		</>
	);
}
