/** biome-ignore-all lint/suspicious/noExplicitAny: integration configs are provider-specific */
"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { alertManagerIntegrationMeta } from "@uptimekit/api/pkg/integrations/definitions/alertmanager-meta";
import { appriseIntegrationMeta } from "@uptimekit/api/pkg/integrations/definitions/apprise-meta";
import { discordIntegrationMeta } from "@uptimekit/api/pkg/integrations/definitions/discord-meta";
import { smtpIntegrationMeta } from "@uptimekit/api/pkg/integrations/definitions/smtp-meta";
import { telegramIntegrationMeta } from "@uptimekit/api/pkg/integrations/definitions/telegram-meta";
import { webhookIntegrationMeta } from "@uptimekit/api/pkg/integrations/definitions/webhook-meta";
import type { IntegrationDefinition } from "@uptimekit/api/pkg/integrations/registry";
import {
	parseAsInteger,
	parseAsString,
	parseAsStringEnum,
	useQueryStates,
} from "nuqs";
import { useEffect, useState } from "react";
import { sileo } from "sileo";
import { z } from "zod";
import {
	ArrowRight,
	Check,
	ChevronDown,
	ChevronLeftIcon,
	ChevronRightIcon,
	Filter,
	Loader2,
	Mail,
	MoreHorizontal,
	Plus,
	Search,
	Send,
	Settings2,
	Trash2,
	Webhook,
} from "@/components/icons";
import { ConfigDialog } from "@/components/integrations/config-dialog";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogPanel,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
} from "@/components/ui/pagination";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { client } from "@/utils/orpc";

const PAGE_SIZE_OPTIONS = ["10", "25", "50", "100"] as const;
const NOTIFICATION_STATUS_FILTERS = ["active", "inactive"] as const;
const NOTIFICATION_DIRECTION_FILTERS = ["export", "import"] as const;
const NOTIFICATION_DEFAULT_FILTERS = ["default", "custom"] as const;

interface ConfiguredNotification {
	id: string;
	name: string;
	type: string;
	config: any;
	active: boolean;
	isDefault: boolean;
	assignedMonitorCount: number;
}

const frontendRegistry = {
	webhook: {
		...webhookIntegrationMeta,
		handler: async () => {},
	} as IntegrationDefinition,
	discord: {
		...discordIntegrationMeta,
		handler: async () => {},
	} as IntegrationDefinition,
	telegram: {
		...telegramIntegrationMeta,
		handler: async () => {},
	} as IntegrationDefinition,
	smtp: {
		...smtpIntegrationMeta,
		handler: async () => {},
	} as IntegrationDefinition,
	alertmanager: {
		...alertManagerIntegrationMeta,
		handler: async () => {},
	} as IntegrationDefinition,
	apprise: {
		...appriseIntegrationMeta,
		handler: async () => {},
	} as IntegrationDefinition,
};

function getIntegrationDefinition(integration: {
	id: string;
	name?: string;
	description?: string;
	type?: "export" | "import";
	events?: string[];
}) {
	return (
		(frontendRegistry as Record<string, IntegrationDefinition>)[
			integration.id
		] ||
		({
			...integration,
			name: integration.name || integration.id,
			type: integration.type || "export",
			configSchema: {
				parse: () => ({}),
				shape: { url: z.string() },
			} as any,
			events: integration.events || [],
			handler: async () => {},
		} as IntegrationDefinition)
	);
}

function IntegrationIcon({
	integration,
}: {
	integration: IntegrationDefinition;
}) {
	if (integration.logo) {
		return (
			<div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
				{/* biome-ignore lint/performance/noImgElement: integration logos are static public assets */}
				<img
					src={integration.logo}
					alt={integration.name}
					className="size-6 object-contain"
				/>
			</div>
		);
	}

	const Icon =
		integration.id === "webhook"
			? Webhook
			: integration.id === "smtp"
				? Mail
				: Settings2;

	return (
		<div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted">
			<Icon className="size-5" />
		</div>
	);
}

function formatMonitorAssignmentCount(count: number) {
	return `${count} monitor${count === 1 ? "" : "s"}`;
}

function matchesSearch(
	config: ConfiguredNotification,
	integration: IntegrationDefinition,
	search: string,
) {
	if (!search) {
		return true;
	}

	return [
		config.name,
		config.type,
		integration.name,
		integration.description,
		integration.type,
		config.active ? "active" : "inactive",
		config.isDefault ? "default" : "custom",
	]
		.filter(Boolean)
		.some((value) => value?.toLowerCase().includes(search));
}

export function NotificationsTable() {
	const [providerDialogOpen, setProviderDialogOpen] = useState(false);
	const [searchOpen, setSearchOpen] = useState(false);
	const [selectedIntegration, setSelectedIntegration] =
		useState<IntegrationDefinition | null>(null);
	const [selectedConfig, setSelectedConfig] =
		useState<ConfiguredNotification | null>(null);
	const [configToRemove, setConfigToRemove] =
		useState<ConfiguredNotification | null>(null);
	const [filters, setFilters] = useQueryStates({
		search: parseAsString.withDefault(""),
		status: parseAsStringEnum([...NOTIFICATION_STATUS_FILTERS]),
		direction: parseAsStringEnum([...NOTIFICATION_DIRECTION_FILTERS]),
		type: parseAsString,
		default: parseAsStringEnum([...NOTIFICATION_DEFAULT_FILTERS]),
		page: parseAsInteger.withDefault(1),
		pageSize: parseAsStringEnum([...PAGE_SIZE_OPTIONS]).withDefault("25"),
	});
	const {
		search,
		status: statusFilter,
		direction: directionFilter,
		type: typeFilter,
		default: defaultFilter,
		page: pageParam,
		pageSize: pageSizeParam,
	} = filters;
	const page = Math.max(pageParam, 1);
	const pageSize = Number(pageSizeParam);
	const [searchInput, setSearchInput] = useState(search);
	const [debouncedSearch, setDebouncedSearch] = useState(search);

	useEffect(() => {
		setSearchInput(search);
	}, [search]);

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(searchInput);
			if (searchInput !== search) {
				void setFilters({
					search: searchInput || null,
					page: 1,
				});
			}
		}, 500);
		return () => clearTimeout(timer);
	}, [searchInput, setFilters, search]);

	const { data: availableIntegrations, isLoading: isLoadingAvailable } =
		useQuery({
			queryKey: ["integrations", "available"],
			queryFn: async () => client.integrations.listAvailable(),
		});

	const {
		data: configuredConfigs,
		isLoading: isLoadingConfigured,
		refetch,
	} = useQuery({
		queryKey: ["integrations", "configured"],
		queryFn: async () => client.integrations.listConfigured(),
	});

	const configureMutation = useMutation({
		mutationFn: async (data: {
			id?: string;
			name: string;
			type: string;
			config: any;
			active: boolean;
			isDefault: boolean;
			applyToExistingMonitors: boolean;
		}) => {
			await client.integrations.configure(data);
		},
		onSuccess: () => {
			refetch();
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (id: string) => {
			await client.integrations.delete({ id });
		},
		onSuccess: () => {
			refetch();
		},
	});

	const testMutation = useMutation({
		mutationFn: async (id: string) => {
			await client.integrations.test({ id });
		},
	});

	const configuredNotifications =
		(configuredConfigs as ConfiguredNotification[] | undefined) || [];
	const normalizedSearch = debouncedSearch.trim().toLowerCase();
	const filteredNotifications = configuredNotifications.filter((config) => {
		const integration = getIntegrationDefinition({ id: config.type });

		if (statusFilter === "active" && !config.active) {
			return false;
		}

		if (statusFilter === "inactive" && config.active) {
			return false;
		}

		if (directionFilter && integration.type !== directionFilter) {
			return false;
		}

		if (typeFilter && config.type !== typeFilter) {
			return false;
		}

		if (defaultFilter === "default" && !config.isDefault) {
			return false;
		}

		if (defaultFilter === "custom" && config.isDefault) {
			return false;
		}

		return matchesSearch(config, integration, normalizedSearch);
	});
	const total = filteredNotifications.length;
	const totalPages = Math.ceil(total / pageSize);
	const visibleStart =
		total === 0 ? 0 : Math.min((page - 1) * pageSize + 1, total);
	const visibleEnd = total === 0 ? 0 : Math.min(page * pageSize, total);
	const paginatedNotifications = filteredNotifications.slice(
		(page - 1) * pageSize,
		page * pageSize,
	);
	const activeFilterCount = [
		statusFilter !== null,
		directionFilter !== null,
		typeFilter !== null,
		defaultFilter !== null,
	].filter(Boolean).length;
	const hasActiveSearchOrFilters =
		search ||
		statusFilter !== null ||
		directionFilter !== null ||
		typeFilter !== null ||
		defaultFilter !== null;

	useEffect(() => {
		if (totalPages > 0 && page > totalPages) {
			void setFilters({ page: totalPages });
		}
	}, [page, setFilters, totalPages]);

	const clearFilters = () => {
		setSearchInput("");
		void setFilters({
			search: null,
			status: null,
			direction: null,
			type: null,
			default: null,
			page: 1,
		});
	};

	const handleTestNotification = async (id: string) => {
		try {
			await testMutation.mutateAsync(id);
			sileo.success({ title: "Test event sent successfully" });
		} catch (error: any) {
			sileo.error({
				title: error.message || "Failed to send test event",
			});
		}
	};

	return (
		<div className="mx-auto w-full max-w-6xl space-y-4">
			<Dialog open={searchOpen} onOpenChange={setSearchOpen}>
				<DialogContent className="flex items-center justify-center border-none bg-transparent p-0 shadow-none sm:max-w-[425px]">
					<DialogTitle className="sr-only">Search</DialogTitle>
					<div className="relative w-full">
						<Input
							autoFocus
							placeholder="Search notifications..."
							className="h-12 rounded-full border-muted bg-background pr-12 pl-6 shadow-lg"
							value={searchInput}
							onChange={(e) => setSearchInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									setSearchOpen(false);
								}
							}}
						/>
						<Button
							size="icon"
							className="absolute top-1 right-1 h-10 w-10 rounded-full"
							onClick={() => setSearchOpen(false)}
						>
							<ArrowRight className="h-4 w-4" />
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			<div className="flex items-center justify-between gap-4">
				<h1 className="font-bold text-2xl tracking-tight">Notifications</h1>
				<div className="flex items-center gap-2">
					<div className="relative hidden w-64 md:block">
						<Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search notifications..."
							className="pl-8"
							value={searchInput}
							onChange={(e) => setSearchInput(e.target.value)}
						/>
					</div>
					<Button
						variant="outline"
						size="icon"
						className="relative md:hidden"
						onClick={() => setSearchOpen(true)}
					>
						<Search className="h-4 w-4" />
						{search && (
							<span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary" />
						)}
					</Button>
					<DropdownMenu modal={false}>
						<DropdownMenuTrigger
							render={
								<Button variant="outline" size="icon" className="relative" />
							}
						>
							<Filter className="h-4 w-4" />
							{activeFilterCount > 0 && (
								<span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground">
									{activeFilterCount}
								</span>
							)}
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56 p-2">
							<div className="mb-2 px-2 font-semibold text-muted-foreground text-xs uppercase">
								Status
							</div>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ status: null, page: 1 });
								}}
								className="flex justify-between"
							>
								All Statuses
								{statusFilter === null && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ status: "active", page: 1 });
								}}
								className="flex justify-between"
							>
								Active
								{statusFilter === "active" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ status: "inactive", page: 1 });
								}}
								className="flex justify-between"
							>
								Inactive
								{statusFilter === "inactive" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>

							<div className="my-2 h-px bg-muted" />

							<div className="mb-2 px-2 font-semibold text-muted-foreground text-xs uppercase">
								Direction
							</div>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ direction: null, page: 1 });
								}}
								className="flex justify-between"
							>
								All Directions
								{directionFilter === null && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ direction: "export", page: 1 });
								}}
								className="flex justify-between"
							>
								Export
								{directionFilter === "export" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ direction: "import", page: 1 });
								}}
								className="flex justify-between"
							>
								Import
								{directionFilter === "import" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>

							<div className="my-2 h-px bg-muted" />

							<div className="mb-2 px-2 font-semibold text-muted-foreground text-xs uppercase">
								Provider
							</div>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ type: null, page: 1 });
								}}
								className="flex justify-between"
							>
								All Providers
								{typeFilter === null && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							{availableIntegrations?.map((integrationMeta) => {
								const integration = getIntegrationDefinition(integrationMeta);

								return (
									<DropdownMenuItem
										key={integration.id}
										onClick={() => {
											void setFilters({ type: integration.id, page: 1 });
										}}
										className="flex justify-between gap-2"
									>
										<span className="truncate">{integration.name}</span>
										{typeFilter === integration.id && (
											<Check className="h-4 w-4" />
										)}
									</DropdownMenuItem>
								);
							})}

							<div className="my-2 h-px bg-muted" />

							<div className="mb-2 px-2 font-semibold text-muted-foreground text-xs uppercase">
								Default
							</div>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ default: null, page: 1 });
								}}
								className="flex justify-between"
							>
								All Notifications
								{defaultFilter === null && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ default: "default", page: 1 });
								}}
								className="flex justify-between"
							>
								Default
								{defaultFilter === "default" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ default: "custom", page: 1 });
								}}
								className="flex justify-between"
							>
								Custom
								{defaultFilter === "custom" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>

							<div className="my-2 h-px bg-muted" />

							<div className="mb-2 px-2 font-semibold text-muted-foreground text-xs uppercase">
								Page Size
							</div>
							{/** biome-ignore lint/a11y/noStaticElementInteractions: keep Select interactions inside the filter menu */}
							{/** biome-ignore lint/a11y/useKeyWithClickEvents: Select handles keyboard interaction */}
							<div
								className="px-2"
								onClick={(e) => e.stopPropagation()}
								onPointerDown={(e) => e.stopPropagation()}
							>
								<Select
									value={pageSizeParam}
									onValueChange={(value) => {
										void setFilters({
											pageSize: value as (typeof PAGE_SIZE_OPTIONS)[number],
											page: 1,
										});
									}}
								>
									<SelectTrigger
										className="h-8 w-full"
										onPointerDown={(e) => e.stopPropagation()}
									>
										<SelectValue placeholder="Page size">
											{pageSize} per page
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										{PAGE_SIZE_OPTIONS.map((size) => (
											<SelectItem key={size} value={size}>
												{size} per page
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{activeFilterCount > 0 && (
								<>
									<div className="my-2 h-px bg-muted" />
									<DropdownMenuItem
										onClick={clearFilters}
										className="justify-center text-red-500 hover:text-red-600"
									>
										Clear filters
									</DropdownMenuItem>
								</>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
					<Button
						className="w-9 gap-2 border-none bg-white p-0 text-black shadow-md shadow-white/10 hover:bg-gray-100 md:w-auto md:px-4"
						disabled={isLoadingAvailable}
						onClick={() => setProviderDialogOpen(true)}
					>
						<Plus className="h-4 w-4" />
						<span className="hidden md:inline">Add notification</span>
					</Button>
				</div>
			</div>

			<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
				<div className="flex min-h-12 items-center gap-3 border-b bg-muted/20 px-4 py-3 font-medium text-muted-foreground text-sm">
					<ChevronDown className="h-4 w-4" />
					<span>Notifications</span>
					{total > 0 && (
						<span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
							{visibleStart}-{visibleEnd} of {total}
						</span>
					)}
				</div>
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead className="min-w-[280px] pl-4">Notification</TableHead>
							<TableHead className="w-[140px]">Direction</TableHead>
							<TableHead className="w-[170px]">Monitor Assignments</TableHead>
							<TableHead className="w-[150px]">Status</TableHead>
							<TableHead className="w-[52px] pr-4 text-right">
								<span className="sr-only">Actions</span>
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoadingConfigured ? (
							<TableRow>
								<TableCell colSpan={5} className="h-24 text-center">
									<Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
								</TableCell>
							</TableRow>
						) : paginatedNotifications.length === 0 ? (
							<TableRow>
								<TableCell colSpan={5} className="h-24 text-center">
									<div className="flex flex-col items-center justify-center gap-2 py-6">
										<div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
											<Send className="h-6 w-6 text-muted-foreground" />
										</div>
										<p className="font-medium text-lg">
											No notifications found
										</p>
										<p className="text-muted-foreground text-sm">
											{hasActiveSearchOrFilters
												? "Try adjusting your filters"
												: "Add a notification channel before assigning it to monitors."}
										</p>
										{!hasActiveSearchOrFilters && (
											<div className="mt-2">
												<Button onClick={() => setProviderDialogOpen(true)}>
													Add notification
												</Button>
											</div>
										)}
									</div>
								</TableCell>
							</TableRow>
						) : (
							paginatedNotifications.map((config) => {
								const integration = getIntegrationDefinition({
									id: config.type,
								});

								return (
									<TableRow
										key={config.id}
										className="group h-[72px] hover:bg-muted/40"
									>
										<TableCell className="min-w-[280px] pl-4">
											<div className="flex items-center gap-4">
												<IntegrationIcon integration={integration} />
												<div className="grid min-w-0 gap-1">
													<span className="truncate font-semibold leading-none transition-colors group-hover:text-primary">
														{config.name}
													</span>
													<div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
														<span>{integration.name}</span>
														{config.isDefault && (
															<Badge
																variant="warning"
																className="h-5 px-1.5 text-[10px]"
															>
																Default
															</Badge>
														)}
													</div>
												</div>
											</div>
										</TableCell>
										<TableCell>
											<Badge
												variant={
													integration.type === "export" ? "info" : "secondary"
												}
												className="capitalize"
											>
												{integration.type}
											</Badge>
										</TableCell>
										<TableCell className="font-medium text-muted-foreground text-sm">
											{formatMonitorAssignmentCount(
												config.assignedMonitorCount,
											)}
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-2">
												<div
													className={cn(
														"h-2 w-2 rounded-full",
														config.active
															? "bg-emerald-500"
															: "bg-muted-foreground/30",
													)}
												/>
												<span
													className={cn(
														"font-medium text-sm",
														config.active
															? "text-emerald-500"
															: "text-muted-foreground",
													)}
												>
													{config.active ? "Active" : "Inactive"}
												</span>
											</div>
										</TableCell>
										<TableCell className="w-[52px] pr-4">
											<DropdownMenu>
												<DropdownMenuTrigger
													render={
														<Button
															variant="ghost"
															size="icon"
															className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
														/>
													}
												>
													<MoreHorizontal className="h-4 w-4" />
													<span className="sr-only">Open menu</span>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														onSelect={() => {
															setSelectedIntegration(integration);
															setSelectedConfig(config);
														}}
													>
														<Settings2 className="h-4 w-4" />
														Edit
													</DropdownMenuItem>
													{integration.type === "export" && (
														<DropdownMenuItem
															disabled={testMutation.isPending}
															onSelect={() => {
																void handleTestNotification(config.id);
															}}
														>
															<Send className="h-4 w-4" />
															Test
														</DropdownMenuItem>
													)}
													<DropdownMenuSeparator />
													<DropdownMenuItem
														variant="destructive"
														onSelect={() => setConfigToRemove(config)}
													>
														<Trash2 className="h-4 w-4" />
														Remove
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</TableCell>
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>

				{totalPages > 1 && (
					<div className="flex items-center justify-end border-t bg-muted/20 px-4 py-3">
						<Pagination className="mx-0 w-auto">
							<PaginationContent>
								<PaginationItem>
									<Button
										variant="ghost"
										size="icon"
										disabled={page === 1}
										onClick={() => void setFilters({ page: page - 1 })}
									>
										<ChevronLeftIcon className="h-4 w-4" />
									</Button>
								</PaginationItem>
								{Array.from({ length: totalPages }, (_, i) => i + 1).map(
									(p) => {
										if (
											totalPages > 7 &&
											(p < page - 2 || p > page + 2) &&
											p !== 1 &&
											p !== totalPages
										) {
											if (p === page - 3 || p === page + 3) {
												return (
													<PaginationItem key={p}>
														<PaginationEllipsis />
													</PaginationItem>
												);
											}
											return null;
										}

										return (
											<PaginationItem key={p}>
												<Button
													variant={p === page ? "outline" : "ghost"}
													size="icon"
													onClick={() => void setFilters({ page: p })}
													className="h-8 w-8"
												>
													{p}
												</Button>
											</PaginationItem>
										);
									},
								)}
								<PaginationItem>
									<Button
										variant="ghost"
										size="icon"
										onClick={() => void setFilters({ page: page + 1 })}
										disabled={page === totalPages}
									>
										<ChevronRightIcon className="h-4 w-4" />
									</Button>
								</PaginationItem>
							</PaginationContent>
						</Pagination>
					</div>
				)}
			</div>

			<Dialog open={providerDialogOpen} onOpenChange={setProviderDialogOpen}>
				<DialogContent className="sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>Add notification</DialogTitle>
						<DialogDescription>
							Choose a provider, then configure where events should be sent.
						</DialogDescription>
					</DialogHeader>
					<DialogPanel className="grid gap-3 sm:grid-cols-2">
						{isLoadingAvailable ? (
							<div className="col-span-full flex h-24 items-center justify-center">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						) : availableIntegrations?.length ? (
							availableIntegrations.map((integrationMeta) => {
								const integration = getIntegrationDefinition(integrationMeta);

								return (
									<button
										key={integration.id}
										type="button"
										className="flex min-w-0 items-center gap-3 rounded-lg border bg-background p-4 text-left transition-colors hover:bg-muted/50"
										onClick={() => {
											setSelectedIntegration(integration);
											setSelectedConfig(null);
											setProviderDialogOpen(false);
										}}
									>
										<IntegrationIcon integration={integration} />
										<div className="min-w-0">
											<div className="flex items-center gap-2">
												<p className="truncate font-medium text-sm">
													{integration.name}
												</p>
												<Badge variant="outline">
													{integration.type === "export" ? "Export" : "Import"}
												</Badge>
											</div>
											<p className="line-clamp-2 text-muted-foreground text-sm">
												{integration.description}
											</p>
										</div>
									</button>
								);
							})
						) : (
							<div className="col-span-full flex h-24 items-center justify-center text-muted-foreground text-sm">
								No providers available.
							</div>
						)}
					</DialogPanel>
				</DialogContent>
			</Dialog>

			{selectedIntegration && (
				<ConfigDialog
					open={!!selectedIntegration}
					onOpenChange={(open) => {
						if (!open) {
							setSelectedIntegration(null);
							setSelectedConfig(null);
						}
					}}
					integration={selectedIntegration}
					initialConfig={selectedConfig?.config}
					configId={selectedConfig?.id}
					initialName={selectedConfig?.name}
					initialActive={selectedConfig?.active ?? true}
					initialIsDefault={selectedConfig?.isDefault ?? false}
					onSave={async (values) => {
						await configureMutation.mutateAsync({
							id: selectedConfig?.id,
							type: selectedIntegration.id,
							...values,
						});
						setSelectedIntegration(null);
						setSelectedConfig(null);
					}}
					onDelete={
						selectedConfig
							? async () => {
									await deleteMutation.mutateAsync(selectedConfig.id);
								}
							: undefined
					}
					onTest={
						selectedConfig
							? async () => {
									await testMutation.mutateAsync(selectedConfig.id);
								}
							: undefined
					}
				/>
			)}

			<AlertDialog
				open={!!configToRemove}
				onOpenChange={(open) => {
					if (!open) setConfigToRemove(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove notification</AlertDialogTitle>
						<AlertDialogDescription>
							Remove {configToRemove?.name}? Monitor assignments for this
							notification will also be removed.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleteMutation.isPending}>
							Cancel
						</AlertDialogCancel>
						<Button
							type="button"
							variant="destructive"
							disabled={deleteMutation.isPending}
							onClick={async () => {
								if (!configToRemove) return;

								try {
									await deleteMutation.mutateAsync(configToRemove.id);
									setConfigToRemove(null);
									sileo.success({ title: "Notification removed" });
								} catch (error: any) {
									sileo.error({
										title: error.message || "Failed to remove notification",
									});
								}
							}}
						>
							{deleteMutation.isPending ? "Removing..." : "Remove"}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
