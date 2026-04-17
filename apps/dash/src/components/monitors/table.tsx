"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
	ArrowRight,
	Check,
	ChevronDown,
	ChevronLeftIcon,
	ChevronRight,
	ChevronRightIcon,
	Filter,
	Folder,
	Loader2,
	MoreHorizontal,
	PlayCircle,
	Plus,
	Search,
	ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import {
	parseAsBoolean,
	parseAsInteger,
	parseAsString,
	parseAsStringEnum,
	useQueryStates,
} from "nuqs";
import { sileo } from "sileo";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
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
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { client, orpc } from "@/utils/orpc";
import { GroupCreationDialog } from "./group-creation-dialog";
import { LatencySparkline } from "./latency-sparkline";
import { TagCreationDialog } from "./tag-creation-dialog";

const PAGE_SIZE_OPTIONS = ["10", "25", "50", "100"] as const;
const MONITOR_STATUS_FILTERS = [
	"up",
	"down",
	"degraded",
	"maintenance",
] as const;
const MONITOR_TYPE_FILTERS = ["http", "ping", "tcp", "keyword"] as const;

export type MonitorStatus =
	| "up"
	| "down"
	| "degraded"
	| "maintenance"
	| "pending";

export interface Monitor {
	id: string;
	name: string;
	url: string;
	status: MonitorStatus;
	statusText: string;
	duration: string;
	usedOn: number;
	frequency: string;
	hasIncident: boolean;
	active: boolean;
	pauseReason?: string | null;
	tags?: Array<{ id: string; name: string; color: string }>;
}

function getPauseLabel(pauseReason?: string | null) {
	switch (pauseReason) {
		case "org_active_monitor_limit":
			return "PAUSED BY MONITOR LIMIT";
		case "org_region_limit":
			return "PAUSED BY REGION LIMIT";
		case "worker_deleted":
			return "PAUSED BY WORKER REMOVAL";
		default:
			return "PAUSED";
	}
}

/**
 * Render the monitors list view with search, filters, grouping, and pagination.
 *
 * Displays a searchable, filterable, and paginated table of monitors with group
 * collapse/expand, tag badges, latency sparklines, and per-monitor actions.
 *
 * @returns The React element for the monitors management UI.
 */
export function MonitorsTable() {
	const [searchOpen, setSearchOpen] = useState(false);
	const [groupsOpen, setGroupsOpen] = useState(false);
	const [tagsOpen, setTagsOpen] = useState(false);
	const [filters, setFilters] = useQueryStates({
		search: parseAsString.withDefault(""),
		active: parseAsBoolean,
		type: parseAsStringEnum([...MONITOR_TYPE_FILTERS]),
		status: parseAsStringEnum([...MONITOR_STATUS_FILTERS]),
		groupId: parseAsString,
		tagId: parseAsString,
		page: parseAsInteger.withDefault(1),
		pageSize: parseAsStringEnum([...PAGE_SIZE_OPTIONS]).withDefault("25"),
	});
	const {
		search,
		active: activeFilter,
		type: typeFilter,
		status: statusFilter,
		groupId: groupFilter,
		tagId: tagFilter,
		page,
		pageSize: pageSizeParam,
	} = filters;
	const pageSize = Number(pageSizeParam);
	const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
		{},
	);

	// Debounce search
	const [searchInput, setSearchInput] = useState(search);
	const [debouncedSearch, setDebouncedSearch] = useState(search);
	useEffect(() => {
		setSearchInput(search);
	}, [search]);

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(searchInput);
			void setFilters({
				search: searchInput || null,
				page: 1,
			});
		}, 500);
		return () => clearTimeout(timer);
	}, [searchInput, setFilters]);

	const { data, isLoading } = useQuery({
		...orpc.monitors.list.queryOptions({
			input: {
				q: debouncedSearch || undefined,
				active: activeFilter ?? undefined,
				type: typeFilter ?? undefined,
				status: statusFilter ?? undefined,
				groupId: groupFilter ?? undefined,
				tagId: tagFilter ?? undefined,
				limit: pageSize,
				offset: (page - 1) * pageSize,
			},
		}),
		refetchInterval: 60_000,
	});

	// Fetch groups and tags for filters
	const { data: groups } = useQuery({
		...orpc.monitors.listGroups.queryOptions(),
	});

	const { data: tags } = useQuery({
		...orpc.monitors.listTags.queryOptions(),
	});

	// Fetch latency sparkline data for all visible monitors
	const monitorIds = data?.items?.map((m) => m.id) ?? [];
	const { data: sparklineData } = useQuery({
		...orpc.monitors.getBatchLatencySparkline.queryOptions({
			input: { monitorIds },
		}),
		enabled: monitorIds.length > 0,
		refetchInterval: 60_000,
	});

	const monitors = data?.items;
	const total = data?.total || 0;
	const totalPages = Math.ceil(total / pageSize);

	const tableData: (Monitor & { groupId?: string })[] =
		monitors?.map((m) => ({
			id: m.id,
			name: m.name,
			url: (m.config as { url: string }).url || "",
			status: (m as any).status || "pending",
			statusText:
				(m as any).status === "up"
					? "Operational"
					: (m as any).status === "down"
						? "Downtime"
						: (m as any).status === "degraded"
							? "Degraded"
							: (m as any).status === "maintenance"
								? "Maintenance"
								: "Pending",
			duration: ((monitor: any) => {
				if (monitor.status === "up") {
					if (monitor.lastStatusChange) {
						return formatDistanceToNow(new Date(monitor.lastStatusChange));
					}
					if (monitor.createdAt) {
						return formatDistanceToNow(new Date(monitor.createdAt));
					}
				} else if (monitor.lastStatusChange) {
					return formatDistanceToNow(new Date(monitor.lastStatusChange));
				}
				return "0s";
			})(m),
			usedOn: (m as any).usedOn || 0,
			frequency: `${m.interval}s`,
			hasIncident: false,
			active: m.active,
			pauseReason: (m as any).pauseReason,
			tags: (m as any).tags || [],
			groupId: (m as any).groupId,
		})) ?? [];

	// Group monitors by groupId
	const groupedMonitors = tableData.reduce(
		(acc, monitor) => {
			const groupId = monitor.groupId || "ungrouped";
			if (!acc[groupId]) {
				acc[groupId] = [];
			}
			acc[groupId].push(monitor);
			return acc;
		},
		{} as Record<string, (Monitor & { groupId?: string })[]>,
	);

	const toggleGroup = (groupId: string) => {
		setExpandedGroups((prev) => ({
			...prev,
			[groupId]: !prev[groupId],
		}));
	};

	const clearFilters = () => {
		setSearchInput("");
		void setFilters({
			search: null,
			active: null,
			type: null,
			status: null,
			groupId: null,
			tagId: null,
			page: 1,
		});
	};

	const activeFilterCount = [
		activeFilter !== null,
		typeFilter !== null,
		statusFilter !== null,
		groupFilter !== null,
		tagFilter !== null,
	].filter(Boolean).length;

	return (
		<div className="mx-auto w-full max-w-6xl space-y-4">
			<Dialog open={searchOpen} onOpenChange={setSearchOpen}>
				<DialogContent className="flex items-center justify-center border-none bg-transparent p-0 shadow-none sm:max-w-[425px]">
					<DialogTitle className="sr-only">Search</DialogTitle>
					<div className="relative w-full">
						<Input
							autoFocus
							placeholder="Search monitors..."
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
				<h1 className="font-bold text-2xl tracking-tight">Monitors</h1>
				<div className="flex items-center gap-2">
					<div className="relative hidden w-64 md:block">
						<Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search monitors..."
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
									<div className="-mt-px">{activeFilterCount}</div>
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
								{!statusFilter && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ status: "up", page: 1 });
								}}
								className="flex justify-between"
							>
								Up
								{statusFilter === "up" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ status: "down", page: 1 });
								}}
								className="flex justify-between"
							>
								Down
								{statusFilter === "down" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ status: "degraded", page: 1 });
								}}
								className="flex justify-between"
							>
								Degraded
								{statusFilter === "degraded" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ status: "maintenance", page: 1 });
								}}
								className="flex justify-between"
							>
								Maintenance
								{statusFilter === "maintenance" && (
									<Check className="h-4 w-4" />
								)}
							</DropdownMenuItem>

							<div className="my-2 h-px bg-muted" />

							<div className="mb-2 px-2 font-semibold text-muted-foreground text-xs uppercase">
								Type
							</div>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ type: null, page: 1 });
								}}
								className="flex justify-between"
							>
								All Types
								{!typeFilter && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ type: "http", page: 1 });
								}}
								className="flex justify-between"
							>
								HTTP
								{typeFilter === "http" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ type: "ping", page: 1 });
								}}
								className="flex justify-between"
							>
								Ping
								{typeFilter === "ping" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ type: "tcp", page: 1 });
								}}
								className="flex justify-between"
							>
								TCP
								{typeFilter === "tcp" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>

							<DropdownMenuItem
								onClick={() => {
									void setFilters({ type: "keyword", page: 1 });
								}}
								className="flex justify-between"
							>
								Keyword
								{typeFilter === "keyword" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>

							<div className="my-2 h-px bg-muted" />

							<div className="mb-2 px-2 font-semibold text-muted-foreground text-xs uppercase">
								Active
							</div>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ active: null, page: 1 });
								}}
								className="flex justify-between"
							>
								All
								{activeFilter === null && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ active: true, page: 1 });
								}}
								className="flex justify-between"
							>
								Active
								{activeFilter === true && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ active: false, page: 1 });
								}}
								className="flex justify-between"
							>
								Paused
								{activeFilter === false && <Check className="h-4 w-4" />}
							</DropdownMenuItem>

							<div className="my-2 h-px bg-muted" />

							<div className="mb-2 flex items-center justify-between px-2 font-semibold text-muted-foreground text-xs uppercase">
								Group
								<Button
									variant="ghost"
									size="icon"
									className="h-4 w-4"
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										setGroupsOpen(true);
									}}
								>
									<Plus className="h-3 w-3" />
								</Button>
							</div>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ groupId: null, page: 1 });
								}}
								className="flex justify-between"
							>
								All Groups
								{!groupFilter && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							{groups?.map((group) => (
								<DropdownMenuItem
									key={group.id}
									onClick={() => {
										void setFilters({ groupId: group.id, page: 1 });
									}}
									className="flex justify-between"
								>
									<div className="flex items-center gap-2">
										<Folder className="h-3 w-3 text-muted-foreground" />
										{group.name}
									</div>
									{groupFilter === group.id && <Check className="h-4 w-4" />}
								</DropdownMenuItem>
							))}

							<div className="my-2 h-px bg-muted" />

							<div className="mb-2 px-2 font-semibold text-muted-foreground text-xs uppercase">
								Page Size
							</div>
							{/** biome-ignore lint/a11y/noStaticElementInteractions: its okay */}
							{/** biome-ignore lint/a11y/useKeyWithClickEvents: ITS OKAY! */}
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

							<div className="my-2 h-px bg-muted" />

							<div className="mb-2 flex items-center justify-between px-2 font-semibold text-muted-foreground text-xs uppercase">
								Tag
								<Button
									variant="ghost"
									size="icon"
									className="h-4 w-4"
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										setTagsOpen(true);
									}}
								>
									<Plus className="h-3 w-3" />
								</Button>
							</div>
							<DropdownMenuItem
								onClick={() => {
									void setFilters({ tagId: null, page: 1 });
								}}
								className="flex justify-between"
							>
								All Tags
								{!tagFilter && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							{tags?.map((tag) => (
								<DropdownMenuItem
									key={tag.id}
									onClick={() => {
										void setFilters({ tagId: tag.id, page: 1 });
									}}
									className="flex justify-between"
								>
									<div className="flex items-center gap-2">
										<div
											className="h-3 w-3 rounded-full"
											style={{ backgroundColor: tag.color }}
										/>
										{tag.name}
									</div>
									{tagFilter === tag.id && <Check className="h-4 w-4" />}
								</DropdownMenuItem>
							))}

							{(activeFilter !== undefined ||
								typeFilter !== null ||
								statusFilter !== null ||
								groupFilter !== null ||
								tagFilter !== null) && (
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
						render={
							<Link href="/monitors/new">
								<Plus className="h-4 w-4" />
								<span className="hidden md:inline">Create monitor</span>
							</Link>
						}
					/>
				</div>
			</div>

			<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
				<div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-3 font-medium text-muted-foreground text-sm">
					<ChevronDown className="h-4 w-4" />
					Monitors
				</div>
				<Table>
					<TableBody>
						{isLoading ? (
							<TableRow>
								<TableCell colSpan={6} className="h-24 text-center">
									<Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
								</TableCell>
							</TableRow>
						) : !tableData || tableData.length === 0 ? (
							<TableRow>
								<TableCell colSpan={6} className="h-24 text-center">
									<div className="flex flex-col items-center justify-center gap-2 py-6">
										<div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
											<PlayCircle className="h-6 w-6 text-muted-foreground" />
										</div>
										<p className="font-medium text-lg">No monitors found</p>
										<p className="text-muted-foreground text-sm">
											{search ||
											activeFilter !== null ||
											typeFilter ||
											statusFilter ||
											groupFilter ||
											tagFilter
												? "Try adjusting your filters"
												: "Get started by creating your first monitor."}
										</p>
										{!search &&
											activeFilter === null &&
											!typeFilter &&
											!statusFilter &&
											!groupFilter &&
											!tagFilter && (
												<div className="mt-2">
													<Button render={<Link href="/monitors/new" />}>
														Create monitor
													</Button>
												</div>
											)}
									</div>
								</TableCell>
							</TableRow>
						) : (
							Object.entries(groupedMonitors).map(([groupId, monitors]) => {
								const group = groups?.find((g) => g.id === groupId);
								const groupName = group?.name || "Ungrouped";
								const isExpanded = expandedGroups[groupId] ?? true;

								return (
									<Fragment key={groupId}>
										{/* Group Header */}
										<TableRow
											className="cursor-pointer border-b bg-muted/10 hover:bg-muted/20"
											onClick={() => toggleGroup(groupId)}
										>
											<TableCell colSpan={6} className="py-3">
												<div className="flex select-none items-center gap-2 font-medium text-sm">
													<ChevronRight
														className={cn(
															"h-4 w-4 transition-transform",
															isExpanded && "rotate-90",
														)}
													/>
													<Folder className="h-4 w-4 text-muted-foreground" />
													<span>{groupName}</span>
													<span className="text-muted-foreground text-xs">
														({monitors.length})
													</span>
												</div>
											</TableCell>
										</TableRow>

										{/* Group Monitors */}
										{isExpanded &&
											monitors.map((monitor) => (
												<TableRow
													key={monitor.id}
													className={cn(
														"group h-[72px] hover:bg-muted/40",
														!monitor.active && "opacity-50 grayscale",
													)}
												>
													<TableCell className="w-[50px] pl-6">
														<div
															className={cn(
																"h-2.5 w-2.5 rounded-full shadow-sm",
																monitor.status === "up" &&
																	"bg-emerald-500 shadow-emerald-500/20",
																monitor.status === "down" &&
																	"bg-red-500 shadow-red-500/20",
																monitor.status === "degraded" &&
																	"bg-amber-500 shadow-amber-500/20",
																monitor.status === "maintenance" &&
																	"bg-blue-500 shadow-blue-500/20",
																monitor.status === "pending" &&
																	"bg-zinc-500 shadow-zinc-500/20",
															)}
														/>
													</TableCell>
													<TableCell>
														<Link
															href={`/monitors/${monitor.id}`}
															className="block h-full w-full"
														>
															<div className="grid gap-1">
																<span className="flex items-center gap-2 font-semibold leading-none transition-colors group-hover:text-primary">
																	{monitor.name}
																	{!monitor.active && (
																		<span className="rounded-full bg-muted px-2 py-0.5 font-medium text-[10px] text-muted-foreground">
																			{getPauseLabel(monitor.pauseReason)}
																		</span>
																	)}
																	{monitor.tags && monitor.tags.length > 0 && (
																		<div className="flex items-center gap-1">
																			{monitor.tags.map((tag) => (
																				<span
																					key={tag.id}
																					className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-[10px]"
																					style={{
																						backgroundColor: `${tag.color}20`,
																						color: tag.color,
																					}}
																				>
																					{tag.name}
																				</span>
																			))}
																		</div>
																	)}
																</span>
																<div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
																	<span
																		className={cn(
																			monitor.status === "up" &&
																				"text-emerald-500",
																			monitor.status === "down" &&
																				"text-red-500",
																			monitor.status === "degraded" &&
																				"text-amber-500",
																			monitor.status === "maintenance" &&
																				"text-blue-500",
																			monitor.status === "pending" &&
																				"text-zinc-500",
																		)}
																	>
																		{monitor.statusText}
																	</span>
																	<span>·</span>
																	<span>{monitor.duration}</span>
																	<span>·</span>
																	<span className="underline decoration-muted-foreground/50 decoration-dashed underline-offset-2 transition-colors hover:text-foreground">
																		Used on {monitor.usedOn} status page
																		{monitor.usedOn !== 1 ? "s" : ""}
																	</span>
																</div>
															</div>
														</Link>
													</TableCell>
													<TableCell className="w-[200px]">
														{monitor.hasIncident && (
															<div className="inline-flex items-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/10 px-2.5 py-1 font-medium text-red-500 text-xs">
																<ShieldAlert className="h-3.5 w-3.5" />
																Ongoing Incident
																<ChevronRight className="ml-1 h-3 w-3 opacity-50" />
															</div>
														)}
													</TableCell>
													<TableCell className="w-[100px] font-medium text-muted-foreground text-sm">
														<div className="flex items-center gap-2">
															<PlayCircle className="h-4 w-4 opacity-50" />
															{monitor.frequency}
														</div>
													</TableCell>
													<TableCell className="w-[50px]">
														<MonitorActions monitor={monitor} />
													</TableCell>
													<TableCell className="relative hidden w-[140px] p-0 lg:table-cell">
														<LatencySparkline
															data={sparklineData?.[monitor.id] ?? []}
														/>
													</TableCell>
												</TableRow>
											))}
									</Fragment>
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
										// Simple windowing logic
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

			<GroupCreationDialog open={groupsOpen} onOpenChange={setGroupsOpen} />
			<TagCreationDialog open={tagsOpen} onOpenChange={setTagsOpen} />
		</div>
	);
}

function MonitorActions({ monitor }: { monitor: Monitor }) {
	const queryClient = useQueryClient();
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

	const { mutate: deleteMonitor } = useMutation({
		mutationFn: (id: string) => client.monitors.delete({ id }),
		onSuccess: () => {
			setDeleteDialogOpen(false);
			sileo.success({ title: "Monitor deleted" });
			queryClient.invalidateQueries({ queryKey: orpc.monitors.list.key() });
		},
		onError: () => sileo.error({ title: "Failed to delete monitor" }),
	});

	const { mutate: toggleMonitor } = useMutation({
		mutationFn: ({ id, active }: { id: string; active: boolean }) =>
			client.monitors.toggle({ id, active }),
		onSuccess: () => {
			sileo.success({ title: "Monitor updated" });
			queryClient.invalidateQueries({ queryKey: orpc.monitors.list.key() });
		},
		onError: () => sileo.error({ title: "Failed to update monitor" }),
	});

	return (
		<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
						/>
					}
				>
					<MoreHorizontal className="h-4 w-4" />
					<span className="sr-only">Open menu</span>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem render={<Link href={`/monitors/${monitor.id}`} />}>
						View details
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={(e) => {
							e.stopPropagation();
							toggleMonitor({ id: monitor.id, active: !monitor.active });
						}}
					>
						{monitor.active
							? "Pause monitoring"
							: monitor.pauseReason
								? "Resume monitoring (re-check limits)"
								: "Resume monitoring"}
					</DropdownMenuItem>
					<DropdownMenuItem
						className="text-red-500"
						onClick={(e) => {
							e.stopPropagation();
							setDeleteDialogOpen(true);
						}}
					>
						Delete
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
					<AlertDialogDescription>
						This action cannot be undone. This will permanently delete the
						monitor and all of its data.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<Button
						type="button"
						variant="destructive"
						onClick={(e) => {
							e.stopPropagation();
							deleteMonitor(monitor.id);
						}}
					>
						Delete
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
