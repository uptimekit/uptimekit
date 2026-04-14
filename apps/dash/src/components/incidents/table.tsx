"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
	ArrowRight,
	Check,
	CheckCircle2,
	ChevronDown,
	ChevronLeftIcon,
	ChevronRightIcon,
	Filter,
	HelpCircle,
	Loader2,
	MoreHorizontal,
	Plus,
	Search,
	ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
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

/**
 * Renders a paginated, filterable incidents table with search, filters, and per-incident actions (view, delete).
 *
 * The component debounces the search input (500ms) and resets pagination on search or filter changes. It fetches
 * incidents via the incidents list query using status, severity, type, search, limit (10) and offset derived from the
 * current page. Shows loading and empty states, displays severity/type badges and status indicators, and provides
 * a per-incident delete action that confirms with the user, performs a deletion mutation, shows success/error toasts,
 * and invalidates the incidents list cache on success.
 *
 * @returns The component's JSX element containing the incidents table UI.
 */
export function IncidentsTable() {
	const [statusFilter, setStatusFilter] = useState<
		"all" | "open" | "resolved" | undefined
	>("all");
	const [severityFilter, setSeverityFilter] = useState<
		"minor" | "major" | "critical" | undefined
	>(undefined);
	const [typeFilter, setTypeFilter] = useState<
		"manual" | "automatic" | undefined
	>(undefined);
	const [search, setSearch] = useState("");
	const [searchOpen, setSearchOpen] = useState(false);
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [page, setPage] = useState(1);
	const [incidentToDelete, setIncidentToDelete] = useState<{
		id: string;
		title: string;
		status: string;
		severity: string;
		type: string;
		startedAt: Date;
		endedAt: Date | null;
		monitors: { monitor: { id: string; name: string } }[];
		statusPages: {
			statusPageId: string;
			statusPage: { id: string; name: string };
		}[];
	} | null>(null);
	const pageSize = 10;

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(search);
			setPage(1); // Reset page on search change
		}, 500);
		return () => clearTimeout(timer);
	}, [search]);

	const { data, isLoading } = useQuery(
		orpc.incidents.list.queryOptions({
			input: {
				status: statusFilter === "all" ? "all" : statusFilter || "all",
				limit: pageSize,
				offset: (page - 1) * pageSize,
				q: debouncedSearch || undefined,
				severity: severityFilter,
				type: typeFilter,
			},
		}),
	);

	const incidents = data?.items;
	const total = data?.total || 0;
	const totalPages = Math.ceil(total / pageSize);

	const queryClient = useQueryClient();

	const { mutate: deleteIncident, isPending: isDeleting } = useMutation({
		mutationFn: (id: string) => client.incidents.delete({ id }),
		onSuccess: () => {
			sileo.success({ title: "Incident deleted" });
			queryClient.invalidateQueries({ queryKey: orpc.incidents.list.key() });
			setIncidentToDelete(null);
		},
		onError: (err) => {
			sileo.error({ title: `Failed to delete incident: ${err.message}` });
			setIncidentToDelete(null);
		},
	});

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "resolved":
				return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
			case "investigating":
			case "identified":
			case "monitoring":
				return <ShieldAlert className="h-5 w-5 text-red-500" />;
			default:
				return <HelpCircle className="h-5 w-5 text-muted-foreground" />;
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "resolved":
				return "border-emerald-500/20 bg-emerald-500/10 text-emerald-500";
			case "investigating":
			case "identified":
			case "monitoring":
				return "border-red-500/20 bg-red-500/10 text-red-500";
			default:
				return "border-muted bg-muted/50 text-muted-foreground";
		}
	};

	const clearFilters = () => {
		setSearch("");
		setStatusFilter("all");
		setSeverityFilter(undefined);
		setTypeFilter(undefined);
		setPage(1);
	};

	const activeFilterCount = [
		statusFilter !== "all",
		severityFilter !== undefined,
		typeFilter !== undefined,
	].filter(Boolean).length;

	return (
		<div className="mx-4 mx-auto w-full max-w-6xl space-y-4">
			<Dialog open={searchOpen} onOpenChange={setSearchOpen}>
				<DialogContent className="flex items-center justify-center border-none bg-transparent p-0 shadow-none sm:max-w-[425px]">
					<DialogTitle className="sr-only">Search</DialogTitle>
					<div className="relative w-full">
						<Input
							autoFocus
							placeholder="Search incidents..."
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
				<h1 className="font-bold text-2xl tracking-tight">Incidents</h1>
				<div className="flex items-center gap-2">
					<div className="relative hidden w-64 md:block">
						<Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search incidents..."
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
							<span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary" />
						)}
					</Button>
					<DropdownMenu>
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
									setStatusFilter("all");
									setPage(1);
								}}
								className="flex justify-between"
							>
								All
								{statusFilter === "all" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									setStatusFilter("open");
									setPage(1);
								}}
								className="flex justify-between"
							>
								Open
								{statusFilter === "open" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									setStatusFilter("resolved");
									setPage(1);
								}}
								className="flex justify-between"
							>
								Resolved
								{statusFilter === "resolved" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>

							<div className="my-2 h-px bg-muted" />

							<div className="mb-2 px-2 font-semibold text-muted-foreground text-xs uppercase">
								Severity
							</div>
							<DropdownMenuItem
								onClick={() => {
									setSeverityFilter(undefined);
									setPage(1);
								}}
								className="flex justify-between"
							>
								All Severities
								{!severityFilter && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									setSeverityFilter("minor");
									setPage(1);
								}}
								className="flex justify-between"
							>
								Minor
								{severityFilter === "minor" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									setSeverityFilter("major");
									setPage(1);
								}}
								className="flex justify-between"
							>
								Major
								{severityFilter === "major" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									setSeverityFilter("critical");
									setPage(1);
								}}
								className="flex justify-between"
							>
								Critical
								{severityFilter === "critical" && <Check className="h-4 w-4" />}
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
									setTypeFilter("manual");
									setPage(1);
								}}
								className="flex justify-between"
							>
								Manual
								{typeFilter === "manual" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									setTypeFilter("automatic");
									setPage(1);
								}}
								className="flex justify-between"
							>
								Automatic
								{typeFilter === "automatic" && <Check className="h-4 w-4" />}
							</DropdownMenuItem>

							{(statusFilter !== "all" ||
								severityFilter !== undefined ||
								typeFilter !== undefined) && (
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
							<Link href="/incidents/new">
								<Plus className="h-4 w-4" />
								<span className="hidden md:inline">Report a new incident</span>
							</Link>
						}
					/>
				</div>
			</div>

			<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
				<div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-3 font-medium text-muted-foreground text-sm">
					<ChevronDown className="h-4 w-4" />
					Incidents
				</div>
				<Table>
					<TableBody>
						{isLoading ? (
							<TableRow>
								<TableCell colSpan={3} className="h-24 text-center">
									<Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
								</TableCell>
							</TableRow>
						) : !incidents || incidents.length === 0 ? (
							<TableRow>
								<TableCell colSpan={3} className="h-24 text-center">
									<div className="flex flex-col items-center justify-center gap-2 py-6">
										<div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
											<ShieldAlert className="h-6 w-6 text-muted-foreground" />
										</div>
										<p className="font-medium text-lg">No incidents found</p>
										<p className="text-muted-foreground text-sm">
											{search ||
											statusFilter !== "all" ||
											severityFilter ||
											typeFilter
												? "Try adjusting your filters"
												: "Get started by creating your first incident."}
										</p>
										{!search &&
											statusFilter === "all" &&
											!severityFilter &&
											!typeFilter && (
												<div className="mt-2">
													<Button
														render={
															<Link href="/incidents/new">Create incident</Link>
														}
													/>
												</div>
											)}
									</div>
								</TableCell>
							</TableRow>
						) : (
							incidents.map((incident) => (
								<TableRow
									key={incident.id}
									className="group h-[72px] cursor-pointer hover:bg-muted/40"
								>
									<TableCell className="pl-6">
										<Link
											href={`/incidents/${incident.id}`}
											className="flex items-center gap-4"
										>
											<div
												className={cn(
													"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
													getStatusColor(incident.status),
												)}
											>
												{getStatusIcon(incident.status)}
											</div>
											<div className="grid gap-1">
												<span className="font-semibold leading-none transition-colors group-hover:text-primary">
													{incident.title}
												</span>
												<div className="flex items-center gap-2 text-muted-foreground text-sm">
													{incident.monitors.length > 0 && (
														<span className="flex items-center gap-1">
															{incident.monitors.length === 1
																? incident.monitors[0].monitor.name
																: `${incident.monitors.length} monitors`}
														</span>
													)}
													{incident.type === "automatic" && (
														<Badge
															variant="outline"
															className="h-5 px-1.5 text-[10px]"
														>
															Auto
														</Badge>
													)}
													{incident.statusPages.length > 0 && (
														<Badge
															variant="secondary"
															className="h-5 px-1.5 text-[10px]"
														>
															Public
														</Badge>
													)}
													{incident.severity && (
														<Badge
															variant="outline"
															className={cn(
																"h-5 border-none px-1.5 text-[10px] uppercase",
																incident.severity === "minor" &&
																	"bg-blue-500/10 text-blue-500",
																incident.severity === "major" &&
																	"bg-amber-500/10 text-amber-500",
																incident.severity === "critical" &&
																	"bg-red-500/10 text-red-500",
															)}
														>
															{incident.severity}
														</Badge>
													)}
												</div>
											</div>
										</Link>
									</TableCell>
									<TableCell className="font-medium text-muted-foreground text-sm">
										{formatDistanceToNow(new Date(incident.startedAt), {
											addSuffix: true,
										})}
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-2">
											<div
												className={cn(
													"h-2 w-2 rounded-full",
													incident.status !== "resolved"
														? "animate-pulse bg-red-500"
														: "bg-muted-foreground/30",
												)}
											/>
											<span
												className={cn(
													"font-medium text-sm capitalize",
													incident.status !== "resolved"
														? "text-red-500"
														: "text-muted-foreground",
												)}
											>
												{incident.status}
											</span>
										</div>
									</TableCell>
									<TableCell>
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
												<DropdownMenuItem
													render={<Link href={`/incidents/${incident.id}`} />}
												>
													View details
												</DropdownMenuItem>
												<DropdownMenuItem
													className="text-red-500"
													onSelect={() => setIncidentToDelete(incident)}
												>
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
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
										// Simple logic for small page counts. For larger, we need ellipsis logic.
										// For now, let's keep it simple or implement a window.
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

			<AlertDialog
				open={!!incidentToDelete}
				onOpenChange={(open) => !open && setIncidentToDelete(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the
							incident &quot;
							{incidentToDelete?.title}&quot; and all of its activity history.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
						<Button
							type="button"
							variant="destructive"
							onClick={() =>
								incidentToDelete && deleteIncident(incidentToDelete.id)
							}
							disabled={isDeleting}
						>
							{isDeleting ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Deleting...
								</>
							) : (
								"Delete"
							)}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
