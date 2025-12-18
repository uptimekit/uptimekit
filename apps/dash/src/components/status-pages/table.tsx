"use client";

import { useQuery } from "@tanstack/react-query";
import {
	BarChart,
	Check,
	ChevronDown,
	ExternalLink,
	Filter,
	Globe,
	Loader2,
	Lock,
	MoreHorizontal,
	Plus,
	Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { orpc } from "@/utils/orpc";
import { DataPagination } from "../ui/data-pagination";
import { CreateStatusPageForm } from "./create-form";

export function StatusPagesTable() {
	const router = useRouter();
	const [createOpen, setCreateOpen] = useState(false);
	const [publicFilter, setPublicFilter] = useState<boolean | undefined>(
		undefined,
	);
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [page, setPage] = useState(1);
	const pageSize = 10;

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(search);
			setPage(1);
		}, 500);
		return () => clearTimeout(timer);
	}, [search]);

	const { data, isLoading } = useQuery(
		orpc.statusPages.list.queryOptions({
			input: {
				q: debouncedSearch || undefined,
				public: publicFilter,
				limit: pageSize,
				offset: (page - 1) * pageSize,
			},
		}),
	);

	const statusPages = data?.items;
	const total = data?.total || 0;
	const totalPages = Math.ceil(total / pageSize);

	const clearFilters = () => {
		setSearch("");
		setPublicFilter(undefined);
		setPage(1);
	};

	const activeFilterCount = [publicFilter !== undefined].filter(Boolean).length;

	return (
		<div className="mx-auto w-full max-w-6xl space-y-4">
			<CreateStatusPageForm open={createOpen} onOpenChange={setCreateOpen} />
			<div className="flex items-center justify-between">
				<h1 className="font-bold text-2xl tracking-tight">Status Pages</h1>
				<div className="flex items-center gap-2">
					<div className="relative w-64">
						<Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search status pages..."
							className="pl-8"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>
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
								Visibility
							</div>
							<DropdownMenuItem
								onClick={() => {
									setPublicFilter(undefined);
									setPage(1);
								}}
								className="flex justify-between"
							>
								All
								{publicFilter === undefined && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									setPublicFilter(true);
									setPage(1);
								}}
								className="flex justify-between"
							>
								Public
								{publicFilter === true && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									setPublicFilter(false);
									setPage(1);
								}}
								className="flex justify-between"
							>
								Private
								{publicFilter === false && <Check className="h-4 w-4" />}
							</DropdownMenuItem>
							{publicFilter !== undefined && (
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
						className="gap-2 border-none bg-white text-black shadow-md shadow-white/10 hover:bg-gray-100"
						onClick={() => setCreateOpen(true)}
					>
						<Plus className="h-4 w-4" />
						Create status page
					</Button>
				</div>
			</div>

			<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
				<div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-3 font-medium text-muted-foreground text-sm">
					<ChevronDown className="h-4 w-4" />
					Status Pages
				</div>
				<Table>
					<TableBody>
						{isLoading ? (
							<TableRow>
								<TableCell colSpan={3} className="py-8 text-center">
									<Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
								</TableCell>
							</TableRow>
						) : !statusPages || statusPages.length === 0 ? (
							<TableRow>
								<TableCell colSpan={3} className="h-24 text-center">
									<div className="flex flex-col items-center justify-center gap-2 py-6">
										<div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
											<Globe className="h-6 w-6 text-muted-foreground" />
										</div>
										<p className="font-medium text-lg">No status pages found</p>
										<p className="text-muted-foreground text-sm">
											{search || publicFilter !== undefined
												? "Try adjusting your filters"
												: "Get started by creating your first status page."}
										</p>
										{!search && publicFilter === undefined && (
											<div className="mt-2">
												<Button onClick={() => setCreateOpen(true)}>
													Create status page
												</Button>
											</div>
										)}
									</div>
								</TableCell>
							</TableRow>
						) : (
							statusPages.map(
								(page: {
									id: string;
									name: string;
									slug: string;
									domain: string | null;
									monitorsCount: number;
									subscribers: number;
									public: boolean;
									description: string | null;
								}) => (
									<TableRow
										key={page.id}
										className="group h-[72px] cursor-pointer hover:bg-muted/40"
										onClick={() =>
											router.push(`/status-pages/${page.id}/settings`)
										}
									>
										<TableCell className="pl-6">
											<div className="grid gap-1">
												<span className="flex items-center gap-2 font-semibold leading-none transition-colors group-hover:text-primary">
													{page.name}
													{!page.public && (
														<Lock className="h-3 w-3 text-muted-foreground" />
													)}
												</span>
												<div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
													<span className="flex items-center gap-1">
														{page.domain || `uptimekit.com/s/${page.slug}`}
														<ExternalLink className="h-3 w-3 opacity-50" />
													</span>
												</div>
											</div>
										</TableCell>
										<TableCell className="w-[200px]">
											<div className="flex items-center gap-4 text-muted-foreground text-sm">
												<div
													className="flex items-center gap-1.5"
													title="Monitors"
												>
													<Globe className="h-4 w-4 opacity-70" />
													<span>{page.monitorsCount}</span>
												</div>
												<div
													className="flex items-center gap-1.5"
													title="Subscribers"
												>
													<BarChart className="h-4 w-4 opacity-70" />
													<span>{page.subscribers}</span>
												</div>
											</div>
										</TableCell>
										<TableCell className="w-[50px] pr-4">
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
														onClick={(e) => e.stopPropagation()}
													>
														<MoreHorizontal className="h-4 w-4" />
														<span className="sr-only">Open menu</span>
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														asChild
														onClick={(e) => e.stopPropagation()}
													>
														<Link
															href={`/s/${page.slug}` as any}
															target="_blank"
														>
															View page
														</Link>
													</DropdownMenuItem>
													<DropdownMenuItem
														asChild
														onClick={(e) => e.stopPropagation()}
													>
														<Link href={`/status-pages/${page.id}/settings`}>
															Edit page
														</Link>
													</DropdownMenuItem>
													<DropdownMenuItem>Theme settings</DropdownMenuItem>
													<DropdownMenuItem>Subscribers</DropdownMenuItem>
													<DropdownMenuItem className="text-red-500">
														Delete
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</TableCell>
									</TableRow>
								),
							)
						)}
					</TableBody>
				</Table>

				<DataPagination page={page} totalPages={totalPages} setPage={setPage} />
			</div>
		</div>
	);
}
