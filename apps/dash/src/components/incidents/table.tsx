"use client";

import {
	CheckCircle2,
	ChevronDown,
	Filter,
	MoreHorizontal,
	Plus,
	Search,
	ShieldAlert,
	Loader2,
	HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export function IncidentsTable() {
	const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved">(
		"all",
	);

	const { data: incidents, isLoading } = useQuery(
		orpc.incidents.list.queryOptions({
			input: { status: statusFilter, limit: 50 },
		}),
	);

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

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="font-bold text-2xl tracking-tight">Incidents</h1>
				<div className="flex items-center gap-2">
					<div className="relative w-64">
						<Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
						<Input placeholder="Search" className="pl-8" />
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="icon">
								<Filter className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => setStatusFilter("all")}>
								All
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setStatusFilter("open")}>
								Open
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setStatusFilter("resolved")}>
								Resolved
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<Button
						className="gap-2 border-none bg-white text-black shadow-md shadow-white/10 hover:bg-gray-100"
						asChild
					>
						<Link href="/incidents/new">
							<Plus className="h-4 w-4" />
							Report a new incident
						</Link>
					</Button>
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
						) : incidents?.length === 0 ? (
							<TableRow>
								<TableCell colSpan={3} className="h-24 text-center">
									<div className="flex flex-col items-center justify-center gap-2 py-6">
										<div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
											<ShieldAlert className="h-6 w-6 text-muted-foreground" />
										</div>
										<p className="font-medium text-lg">No incidents found</p>
										<p className="text-muted-foreground text-sm">
											Get started by creating your first incident.
										</p>
										<div className="mt-2">
											<Button asChild>
												<Link href="/incidents/new">Create incident</Link>
											</Button>
										</div>
									</div>
								</TableCell>
							</TableRow>
						) : (
							incidents?.map((incident) => (
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
												</div>
											</div>
										</Link>
									</TableCell>
									<TableCell className="font-medium text-muted-foreground text-sm">
										{formatDistanceToNow(new Date(incident.createdAt), {
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
													<Link href={`/incidents/${incident.id}`}>
														View details
													</Link>
												</DropdownMenuItem>
												{/* Add more actions later */}
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
