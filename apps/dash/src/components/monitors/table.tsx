import {
	ChevronDown,
	ChevronRight,
	Filter,
	MoreHorizontal,
	PlayCircle,
	Plus,
	Search,
	ShieldAlert,
} from "lucide-react";
import Link from "next/link";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "@/utils/orpc";
import { toast } from "sonner";

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
	hasIncident?: boolean;
	active: boolean;
}

interface MonitorsTableProps {
	data: Monitor[];
}

export function MonitorsTable({ data }: MonitorsTableProps) {
	return (
		<div className="space-y-4">
			{/* ... existing header ... */}
			<div className="flex items-center justify-between">
				<h1 className="font-bold text-2xl tracking-tight">Monitors</h1>
				<div className="flex items-center gap-2">
					<div className="relative w-64">
						<Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
						<Input placeholder="Search" className="pl-8" />
					</div>
					<Button variant="outline" size="icon">
						<Filter className="h-4 w-4" />
					</Button>
					<Button
						asChild
						className="gap-2 border-none bg-white text-black shadow-md shadow-white/10 hover:bg-gray-100"
					>
						<Link href="/monitors/new">
							<Plus className="h-4 w-4" />
							Create monitor
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
						{data.length === 0 ? (
							<TableRow>
								<TableCell colSpan={6} className="h-24 text-center">
									<div className="flex flex-col items-center justify-center gap-2 py-6">
										<div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
											<PlayCircle className="h-6 w-6 text-muted-foreground" />
										</div>
										<p className="font-medium text-lg">No monitors found</p>
										<p className="text-muted-foreground text-sm">
											Get started by creating your first monitor.
										</p>
										<div className="mt-2">
											<Button asChild>
												<Link href="/monitors/new">Create monitor</Link>
											</Button>
										</div>
									</div>
								</TableCell>
							</TableRow>
						) : (
							data.map((monitor) => (
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
									<TableCell className="w-[50px] pr-4">
										<MonitorActions monitor={monitor} />
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
				<DropdownMenuItem
					className="text-red-500"
					onClick={(e) => {
						e.stopPropagation();
						if (confirm("Are you sure?")) {
							deleteMonitor(monitor.id);
						}
					}}
				>
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
