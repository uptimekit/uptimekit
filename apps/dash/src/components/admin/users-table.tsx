"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
	Ban,
	ChevronDown,
	ChevronLeftIcon,
	ChevronRightIcon,
	MoreHorizontal,
	Search,
	Shield,
	ShieldCheck,
	UserX,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { client, orpc } from "@/utils/orpc";

interface User {
	id: string;
	name: string;
	email: string;
	image: string | null;
	role: string | null;
	banned: boolean | null;
	banReason: string | null;
	banExpires: Date | null;
	createdAt: Date;
}

/**
 * Renders a paginated, searchable users table with role and status filters and actions to ban/unban users or change roles.
 *
 * The UI includes a debounced search input, role and status selectors, a table showing user avatars, names, emails, join date, and action menu items for role and ban management, plus pagination controls when needed.
 *
 * @returns A React element containing the users management table and its controls.
 */
export function UsersTable() {
	const queryClient = useQueryClient();
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
	const [statusFilter, setStatusFilter] = useState<"all" | "active" | "banned">(
		"all",
	);
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
		orpc.users.list.queryOptions({
			input: {
				q: debouncedSearch || undefined,
				role: roleFilter,
				status: statusFilter,
				limit: pageSize,
				offset: (page - 1) * pageSize,
			},
		}),
	);

	const banMutation = useMutation({
		mutationFn: async (userId: string) => {
			await client.users.ban({ id: userId });
		},
		onSuccess: () => {
			toast.success("User banned successfully");
			queryClient.invalidateQueries({ queryKey: orpc.users.list.key() });
		},
		onError: (error: Error) => {
			toast.error(error.message);
		},
	});

	const unbanMutation = useMutation({
		mutationFn: async (userId: string) => {
			await client.users.unban({ id: userId });
		},
		onSuccess: () => {
			toast.success("User unbanned successfully");
			queryClient.invalidateQueries({ queryKey: orpc.users.list.key() });
		},
		onError: (error: Error) => {
			toast.error(error.message);
		},
	});

	const setRoleMutation = useMutation({
		mutationFn: async ({
			id,
			role,
		}: {
			id: string;
			role: "admin" | "user";
		}) => {
			await client.users.setRole({ id, role });
		},
		onSuccess: () => {
			toast.success("User role updated successfully");
			queryClient.invalidateQueries({ queryKey: orpc.users.list.key() });
		},
		onError: (error: Error) => {
			toast.error(error.message);
		},
	});

	const users = (data?.items || []) as User[];
	const total = data?.total || 0;
	const totalPages = Math.ceil(total / pageSize);

	return (
		<div className="mx-auto w-full max-w-6xl space-y-4">
			<div className="flex items-center justify-between gap-4">
				<h1 className="font-bold text-2xl tracking-tight">Users</h1>
				<div className="flex items-center gap-2">
					<div className="relative w-64">
						<Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search by name or email"
							className="pl-8"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
					</div>
					<Select
						value={roleFilter}
						onValueChange={(val) => {
							setRoleFilter(val as any);
							setPage(1);
						}}
					>
						<SelectTrigger className="w-[130px]">
							<SelectValue placeholder="Role" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Roles</SelectItem>
							<SelectItem value="admin">Admins</SelectItem>
							<SelectItem value="user">Users</SelectItem>
						</SelectContent>
					</Select>
					<Select
						value={statusFilter}
						onValueChange={(val) => {
							setStatusFilter(val as any);
							setPage(1);
						}}
					>
						<SelectTrigger className="w-[130px]">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Statuses</SelectItem>
							<SelectItem value="active">Active</SelectItem>
							<SelectItem value="banned">Banned</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
				<div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-3 font-medium text-muted-foreground text-sm">
					<ChevronDown className="h-4 w-4" />
					Users ({total})
				</div>
				<Table>
					<TableBody>
						{isLoading ? (
							<TableRow>
								<TableCell colSpan={5} className="h-24 text-center">
									Loading...
								</TableCell>
							</TableRow>
						) : users.length === 0 ? (
							<TableRow>
								<TableCell colSpan={5} className="h-24 text-center">
									<div className="flex flex-col items-center justify-center gap-2 py-6">
										<div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
											<Search className="h-6 w-6 text-muted-foreground" />
										</div>
										<p className="font-medium text-lg">No users found</p>
										<p className="text-muted-foreground text-sm">
											{searchQuery ||
											roleFilter !== "all" ||
											statusFilter !== "all"
												? "No users matching your search."
												: "No users registered yet."}
										</p>
									</div>
								</TableCell>
							</TableRow>
						) : (
							users.map((user) => (
								<TableRow
									key={user.id}
									className="group h-[72px] hover:bg-muted/40"
								>
									<TableCell className="w-[50px] pl-6">
										<Avatar className="h-10 w-10">
											<AvatarImage src={user.image || ""} alt={user.name} />
											<AvatarFallback>
												{user.name.slice(0, 2).toUpperCase()}
											</AvatarFallback>
										</Avatar>
									</TableCell>
									<TableCell>
										<div className="grid gap-1">
											<span className="flex items-center gap-2 font-semibold leading-none">
												{user.name}
												{user.role === "admin" && (
													<Badge variant="secondary" className="text-xs">
														<ShieldCheck className="mr-1 h-3 w-3" />
														Admin
													</Badge>
												)}
												{user.banned && (
													<Badge variant="destructive" className="text-xs">
														<Ban className="mr-1 h-3 w-3" />
														Banned
													</Badge>
												)}
											</span>
											<span className="text-muted-foreground text-sm">
												{user.email}
											</span>
										</div>
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										Joined{" "}
										{formatDistanceToNow(new Date(user.createdAt), {
											addSuffix: true,
										})}
									</TableCell>
									<TableCell className="w-[50px] pr-4">
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
												{user.role === "admin" ? (
													<DropdownMenuItem
														onClick={() =>
															setRoleMutation.mutate({
																id: user.id,
																role: "user",
															})
														}
													>
														<Shield className="mr-2 h-4 w-4" />
														Remove Admin
													</DropdownMenuItem>
												) : (
													<DropdownMenuItem
														onClick={() =>
															setRoleMutation.mutate({
																id: user.id,
																role: "admin",
															})
														}
													>
														<ShieldCheck className="mr-2 h-4 w-4" />
														Make Admin
													</DropdownMenuItem>
												)}
												<DropdownMenuSeparator />
												{user.banned ? (
													<DropdownMenuItem
														onClick={() => unbanMutation.mutate(user.id)}
													>
														<UserX className="mr-2 h-4 w-4" />
														Unban User
													</DropdownMenuItem>
												) : (
													<DropdownMenuItem
														onClick={() => banMutation.mutate(user.id)}
														className="text-red-500"
													>
														<Ban className="mr-2 h-4 w-4" />
														Ban User
													</DropdownMenuItem>
												)}
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
