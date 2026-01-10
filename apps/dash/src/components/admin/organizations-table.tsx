"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
	Activity,
	Building2,
	ChevronDown,
	ChevronLeftIcon,
	ChevronRightIcon,
	Search,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { orpc } from "@/utils/orpc";

interface Organization {
	id: string;
	name: string;
	slug: string;
	logo: string | null;
	plan: string | null;
	createdAt: Date;
	memberCount: number;
	monitorCount: number;
}

const planColors: Record<string, string> = {
	free: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
	pro: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
	enterprise:
		"bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

export function OrganizationsTable() {
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [planFilter, setPlanFilter] = useState<string>("all");
	const [page, setPage] = useState(1);
	const pageSize = 10;

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
				plan: planFilter === "all" ? undefined : planFilter,
				limit: pageSize,
				offset: (page - 1) * pageSize,
			},
		}),
	);

	const organizations = (data?.items || []) as Organization[];
	const total = data?.total || 0;
	const totalPages = Math.ceil(total / pageSize);

	return (
		<div className="mx-auto w-full max-w-6xl space-y-4">
			<div className="flex items-center justify-between gap-4">
				<h1 className="font-bold text-2xl tracking-tight">Organizations</h1>
				<div className="flex items-center gap-2">
					<div className="relative w-64">
						<Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search by name or slug"
							className="pl-8"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
					</div>
					<Select
						value={planFilter}
						onValueChange={(val) => {
							setPlanFilter(val);
							setPage(1);
						}}
					>
						<SelectTrigger className="w-[130px]">
							<SelectValue placeholder="Plan" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Plans</SelectItem>
							<SelectItem value="free">Free</SelectItem>
							<SelectItem value="pro">Pro</SelectItem>
							<SelectItem value="enterprise">Enterprise</SelectItem>
						</SelectContent>
					</Select>
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
											{searchQuery || planFilter !== "all"
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
									className="group h-[72px] hover:bg-muted/40"
								>
									<TableCell className="w-[50px] pl-6">
										<Avatar className="h-10 w-10 rounded-lg">
											<AvatarImage src={org.logo || ""} alt={org.name} />
											<AvatarFallback className="rounded-lg bg-primary/10 text-primary">
												{org.name.slice(0, 2).toUpperCase()}
											</AvatarFallback>
										</Avatar>
									</TableCell>
									<TableCell>
										<div className="grid gap-1">
											<span className="flex items-center gap-2 font-semibold leading-none">
												{org.name}
												<Badge
													variant="secondary"
													className={
														planColors[org.plan || "free"] || planColors.free
													}
												>
													{(org.plan || "free").charAt(0).toUpperCase() +
														(org.plan || "free").slice(1)}
												</Badge>
											</span>
											<span className="text-muted-foreground text-sm">
												/{org.slug}
											</span>
										</div>
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-4 text-muted-foreground text-sm">
											<span className="flex items-center gap-1.5">
												<Users className="h-4 w-4" />
												{org.memberCount} members
											</span>
											<span className="flex items-center gap-1.5">
												<Activity className="h-4 w-4" />
												{org.monitorCount} monitors
											</span>
										</div>
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										Created{" "}
										{formatDistanceToNow(new Date(org.createdAt), {
											addSuffix: true,
										})}
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
