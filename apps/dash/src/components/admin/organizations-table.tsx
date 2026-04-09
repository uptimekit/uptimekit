"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
	Activity,
	Building2,
	ChevronDown,
	ChevronLeftIcon,
	ChevronRightIcon,
	MoreHorizontal,
	Search,
	Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { sileo } from "sileo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
import { client, orpc } from "@/utils/orpc";

interface OrganizationRow {
	id: string;
	name: string;
	slug: string;
	logo: string | null;
	createdAt: Date;
	memberCount: number;
	activeMonitorCount: number;
	totalMonitorCount: number;
	activeMonitorLimit: number | null;
	regionsPerMonitorLimit: number | null;
}

function formatLimit(limit: number | null) {
	return limit === null ? "Unlimited" : String(limit);
}

function toInputValue(limit: number | null) {
	return limit === null ? "" : String(limit);
}

export function OrganizationsTable() {
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [page, setPage] = useState(1);
	const [selectedOrg, setSelectedOrg] = useState<OrganizationRow | null>(null);
	const [activeMonitorLimitInput, setActiveMonitorLimitInput] = useState("");
	const [regionsPerMonitorLimitInput, setRegionsPerMonitorLimitInput] =
		useState("");
	const pageSize = 10;
	const queryClient = useQueryClient();

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(searchQuery);
			setPage(1);
		}, 500);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	const { data, isLoading } = useQuery(
		orpc.organizations.list.queryOptions({
			input: {
				q: debouncedSearch || undefined,
				limit: pageSize,
				offset: (page - 1) * pageSize,
			},
		}),
	);

	const organizations = (data?.items || []) as OrganizationRow[];
	const total = data?.total || 0;
	const totalPages = Math.ceil(total / pageSize);

	const saveMutation = useMutation({
		mutationFn: async () => {
			if (!selectedOrg) {
				return null;
			}

			return client.organizations.updateLimits({
				id: selectedOrg.id,
				activeMonitorLimit:
					activeMonitorLimitInput.trim() === ""
						? null
						: Number(activeMonitorLimitInput),
				regionsPerMonitorLimit:
					regionsPerMonitorLimitInput.trim() === ""
						? null
						: Number(regionsPerMonitorLimitInput),
			});
		},
		onSuccess: async (result) => {
			if (!result) {
				return;
			}

			await queryClient.invalidateQueries({
				queryKey: orpc.organizations.list.key(),
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.organizations.getActiveQuota.key(),
			});

			sileo.success({
				title:
					result.autoPausedMonitorCount > 0 ||
					result.unpublishedIncidentCount > 0
						? `Limits updated. Auto-paused ${result.autoPausedMonitorCount} monitor(s) and unpublished ${result.unpublishedIncidentCount} incident link(s).`
						: "Organization limits updated",
			});
			setSelectedOrg(null);
		},
		onError: (error) => {
			sileo.error({
				title: error.message || "Failed to update organization limits",
			});
		},
	});

	const canSave = useMemo(() => {
		for (const value of [
			activeMonitorLimitInput,
			regionsPerMonitorLimitInput,
		]) {
			if (value.trim() === "") {
				continue;
			}

			const parsed = Number(value);
			if (!Number.isInteger(parsed) || parsed < 1) {
				return false;
			}
		}

		return true;
	}, [activeMonitorLimitInput, regionsPerMonitorLimitInput]);

	const openLimitDialog = (organization: OrganizationRow) => {
		setSelectedOrg(organization);
		setActiveMonitorLimitInput(toInputValue(organization.activeMonitorLimit));
		setRegionsPerMonitorLimitInput(
			toInputValue(organization.regionsPerMonitorLimit),
		);
	};

	return (
		<>
			<div className="mx-auto w-full max-w-6xl space-y-4">
				<div className="flex items-center justify-between gap-4">
					<h1 className="font-bold text-2xl tracking-tight">Organizations</h1>
					<div className="relative w-64">
						<Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search by name or slug"
							className="pl-8"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
					</div>
				</div>

				<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
					<div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-3 font-medium text-muted-foreground text-sm">
						<ChevronDown className="h-4 w-4" />
						Organizations ({total})
					</div>
					<Table>
						<TableBody>
							{isLoading ? (
								<TableRow>
									<TableCell colSpan={5} className="h-24 text-center">
										Loading...
									</TableCell>
								</TableRow>
							) : organizations.length === 0 ? (
								<TableRow>
									<TableCell colSpan={5} className="h-24 text-center">
										<div className="flex flex-col items-center justify-center gap-2 py-6">
											<div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
												<Building2 className="h-6 w-6 text-muted-foreground" />
											</div>
											<p className="font-medium text-lg">
												No organizations found
											</p>
											<p className="text-muted-foreground text-sm">
												{searchQuery
													? "No organizations matching your search."
													: "No organizations created yet."}
											</p>
										</div>
									</TableCell>
								</TableRow>
							) : (
								organizations.map((org) => (
									<TableRow
										key={org.id}
										className="group h-[88px] hover:bg-muted/40"
									>
										<TableCell className="w-[56px] pl-6">
											<Avatar className="h-10 w-10 rounded-lg">
												<AvatarImage src={org.logo || ""} alt={org.name} />
												<AvatarFallback className="rounded-lg bg-primary/10 text-primary">
													{org.name.slice(0, 2).toUpperCase()}
												</AvatarFallback>
											</Avatar>
										</TableCell>
										<TableCell>
											<div className="grid gap-1">
												<span className="font-semibold leading-none">
													{org.name}
												</span>
												<span className="text-muted-foreground text-sm">
													/{org.slug}
												</span>
												<span className="text-muted-foreground text-xs">
													Created{" "}
													{formatDistanceToNow(new Date(org.createdAt), {
														addSuffix: true,
													})}
												</span>
											</div>
										</TableCell>
										<TableCell>
											<div className="flex flex-col gap-1 text-muted-foreground text-sm">
												<span className="flex items-center gap-1.5">
													<Users className="h-4 w-4" />
													{org.memberCount} members
												</span>
												<span className="flex items-center gap-1.5">
													<Activity className="h-4 w-4" />
													{org.activeMonitorCount} active /{" "}
													{org.totalMonitorCount} total
												</span>
											</div>
										</TableCell>
										<TableCell>
											<div className="grid gap-1 text-sm">
												<span>
													Active monitor limit:{" "}
													<span className="font-medium">
														{formatLimit(org.activeMonitorLimit)}
													</span>
												</span>
												<span className="text-muted-foreground">
													Regions per monitor:{" "}
													<span className="font-medium text-foreground">
														{formatLimit(org.regionsPerMonitorLimit)}
													</span>
												</span>
											</div>
										</TableCell>
										<TableCell className="w-[60px] pr-6 text-right">
											<DropdownMenu>
												<DropdownMenuTrigger
													render={<Button variant="ghost" size="icon" />}
												>
													<MoreHorizontal className="h-4 w-4" />
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														onClick={() => openLimitDialog(org)}
													>
														Edit limits
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
											disabled={page === totalPages}
											onClick={() => setPage(page + 1)}
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

			<Dialog
				open={!!selectedOrg}
				onOpenChange={(open) => !open && setSelectedOrg(null)}
			>
				<DialogContent className="sm:max-w-[480px]">
					<DialogHeader>
						<DialogTitle>Edit Organization Limits</DialogTitle>
						<DialogDescription>
							{selectedOrg?.name
								? `Update quota limits for ${selectedOrg.name}. Leave a field blank for unlimited.`
								: "Update organization quota limits."}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 p-6 pt-0">
						<div className="rounded-lg border bg-muted/20 p-3 text-sm">
							<p>
								Current active usage:{" "}
								<span className="font-medium">
									{selectedOrg?.activeMonitorCount ?? 0}
								</span>
							</p>
							<p className="text-muted-foreground">
								Total saved monitors: {selectedOrg?.totalMonitorCount ?? 0}
							</p>
						</div>

						<div className="space-y-2">
							<label
								className="font-medium text-sm"
								htmlFor="active-monitor-limit"
							>
								Active monitor limit
							</label>
							<Input
								id="active-monitor-limit"
								type="number"
								min={1}
								placeholder="Unlimited"
								value={activeMonitorLimitInput}
								onChange={(event) =>
									setActiveMonitorLimitInput(event.target.value)
								}
							/>
						</div>

						<div className="space-y-2">
							<label
								className="font-medium text-sm"
								htmlFor="regions-per-monitor-limit"
							>
								Regions per monitor limit
							</label>
							<Input
								id="regions-per-monitor-limit"
								type="number"
								min={1}
								placeholder="Unlimited"
								value={regionsPerMonitorLimitInput}
								onChange={(event) =>
									setRegionsPerMonitorLimitInput(event.target.value)
								}
							/>
						</div>

						{!canSave && (
							<p className="text-destructive text-sm">
								Limits must be whole numbers greater than or equal to 1, or left
								blank for unlimited.
							</p>
						)}
					</div>

					<DialogFooter>
						<Button
							variant="ghost"
							onClick={() => setSelectedOrg(null)}
							disabled={saveMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							onClick={() => saveMutation.mutate()}
							disabled={!selectedOrg || !canSave || saveMutation.isPending}
						>
							Save limits
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
