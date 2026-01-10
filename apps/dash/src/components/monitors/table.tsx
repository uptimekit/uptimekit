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
	Loader2,
	MoreHorizontal,
	PlayCircle,
	Plus,
	Search,
	ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
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
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { client, orpc } from "@/utils/orpc";
import { LatencySparkline } from "./latency-sparkline";

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
}

export function MonitorsTable() {
	const [search, setSearch] = useState("");
	const [searchOpen, setSearchOpen] = useState(false);
	const [activeFilter, setActiveFilter] = useState<boolean | undefined>(
		undefined,
	);
	const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
	const [statusFilter, setStatusFilter] = useState<string | undefined>(
		undefined,
	);
	const [page, setPage] = useState(1);
	const pageSize = 10;

	// Debounce search
	const [debouncedSearch, setDebouncedSearch] = useState("");
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(search);
			setPage(1);
		}, 500);
		return () => clearTimeout(timer);
	}, [search]);

	const { data, isLoading } = useQuery({
		...orpc.monitors.list.queryOptions({
			input: {
				q: debouncedSearch || undefined,
				active: activeFilter,
				type: typeFilter as any,
				status: statusFilter as any,
				limit: pageSize,
				offset: (page - 1) * pageSize,
			},
		}),
		refetchInterval: 60_000,
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

	const tableData: Monitor[] =
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
		})) ?? [];

	const clearFilters = () => {
		setSearch("");
		setActiveFilter(undefined);
		setTypeFilter(undefined);
		setStatusFilter(undefined);
		setPage(1);
	};

	const activeFilterCount = [
		activeFilter !== undefined,
		typeFilter !== undefined,
		statusFilter !== undefined,
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
							value={search}
							onChange={(e) => setSearch(e.target.value)}
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
							value={search}
							onChange={(e) => setSearch(e.target.value)}
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
							<span className="-right-1 -top-1 absolute flex h-3 w-3 items-center justify-center rounded-full bg-primary" />
						)}
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="icon" className="relative">
								<Filter className="h-4 w-4" />
								{activeFilterCount > 0 && (
									<span className="-top-1 -right-1 absolute flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground">
										{activeFilterCount}
									</span>
								)}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56 p-2">
							<div className="mb-2 px-2 font-semibold text-muted-foreground text-xs uppercase">
								Status
							</div>
							<DropdownMenuItem
								onClick={() => {
									setStatusFilter(undefined);
									setPage(1);
								}}
								className="flex justify-between"
							>
								All Statuses
								{!statusFilter && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									setStatusFilter("up");
									setPage(1);
								}}
								className="flex justify-between"
							>
								Up
								{statusFilter === "up" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									setStatusFilter("down");
									setPage(1);
								}}
								className="flex justify-between"
							>
								Down
								{statusFilter === "down" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									setStatusFilter("degraded");
									setPage(1);
								}}
								className="flex justify-between"
							>
								Degraded
								{statusFilter === "degraded" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									setStatusFilter("maintenance");
									setPage(1);
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
									setTypeFilter(undefined);
									setPage(1);
								}}
								className="flex justify-between"
							>
								All Types
								{!typeFilter && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									setTypeFilter("http");
									setPage(1);
								}}
								className="flex justify-between"
							>
								HTTP
								{typeFilter === "http" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									setTypeFilter("ping");
									setPage(1);
								}}
								className="flex justify-between"
							>
								Ping
								{typeFilter === "ping" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									setTypeFilter("tcp");
									setPage(1);
								}}
								className="flex justify-between"
							>
								TCP
								{typeFilter === "tcp" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>

							<DropdownMenuItem
								onClick={() => {
									setTypeFilter("keyword");
									setPage(1);
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
									setActiveFilter(undefined);
									setPage(1);
								}}
								className="flex justify-between"
							>
								All
								{activeFilter === undefined && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									setActiveFilter(true);
									setPage(1);
								}}
								className="flex justify-between"
							>
								Active
								{activeFilter === true && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									setActiveFilter(false);
									setPage(1);
								}}
								className="flex justify-between"
							>
								Paused
								{activeFilter === false && <Check className="h-4 w-4" />}
							</DropdownMenuItem>

							{(activeFilter !== undefined ||
								typeFilter !== undefined ||
								statusFilter !== undefined) && (
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
						asChild
						className="w-9 gap-2 border-none bg-white p-0 text-black shadow-md shadow-white/10 hover:bg-gray-100 md:w-auto md:px-4"
					>
						<Link href="/monitors/new">
							<Plus className="h-4 w-4" />
							<span className="hidden md:inline">Create monitor</span>
						</Link>
					</Button>
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
											activeFilter !== undefined ||
											typeFilter ||
											statusFilter
												? "Try adjusting your filters"
												: "Get started by creating your first monitor."}
										</p>
										{!search &&
											activeFilter === undefined &&
											!typeFilter &&
											!statusFilter && (
												<div className="mt-2">
													<Button asChild>
														<Link href="/monitors/new">Create monitor</Link>
													</Button>
												</div>
											)}
									</div>
								</TableCell>
							</TableRow>
						) : (
							tableData.map((monitor) => (
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
															PAUSED
														</span>
													)}
												</span>
												<div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
													<span
														className={cn(
															monitor.status === "up" && "text-emerald-500",
															monitor.status === "down" && "text-red-500",
															monitor.status === "degraded" && "text-amber-500",
															monitor.status === "maintenance" &&
																"text-blue-500",
															monitor.status === "pending" && "text-zinc-500",
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
							))
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
										onClick={() => setPage(page - 1)}
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
													onClick={() => setPage(p)}
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
										onClick={() => setPage(page + 1)}
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
		</div>
	);
}

function MonitorActions({ monitor }: { monitor: Monitor }) {
	const queryClient = useQueryClient();

	const { mutate: deleteMonitor } = useMutation({
		mutationFn: (id: string) => client.monitors.delete({ id }),
		onSuccess: () => {
			toast.success("Monitor deleted");
			queryClient.invalidateQueries({ queryKey: orpc.monitors.list.key() });
		},
		onError: () => toast.error("Failed to delete monitor"),
	});

	const { mutate: toggleMonitor } = useMutation({
		mutationFn: ({ id, active }: { id: string; active: boolean }) =>
			client.monitors.toggle({ id, active }),
		onSuccess: () => {
			toast.success("Monitor updated");
			queryClient.invalidateQueries({ queryKey: orpc.monitors.list.key() });
		},
		onError: () => toast.error("Failed to update monitor"),
	});

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
				>
					<MoreHorizontal className="h-4 w-4" />
					<span className="sr-only">Open menu</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem asChild>
					<Link href={`/monitors/${monitor.id}`}>View details</Link>
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={(e) => {
						e.stopPropagation();
						toggleMonitor({ id: monitor.id, active: !monitor.active });
					}}
				>
					{monitor.active ? "Pause monitoring" : "Resume monitoring"}
				</DropdownMenuItem>
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<DropdownMenuItem
							className="text-red-500"
							onSelect={(e) => e.preventDefault()}
						>
							Delete
						</DropdownMenuItem>
					</AlertDialogTrigger>
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
							<AlertDialogAction
								className="bg-red-500 hover:bg-red-600"
								onClick={(e) => {
									e.stopPropagation();
									deleteMonitor(monitor.id);
								}}
							>
								Delete
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
