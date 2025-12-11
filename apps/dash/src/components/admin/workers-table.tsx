"use client";

import { CreateWorkerDialog } from "@/components/admin/create-worker-dialog";
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
import { AQ, AU, BR, CA, EU, HK, US, ZA } from "country-flag-icons/react/3x2";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, MoreHorizontal, RotateCcw, Search } from "lucide-react";
import Link from "next/link";

interface Worker {
	id: string;
	name: string;
	location: string;
	active: boolean;
	lastHeartbeat: Date | null;
	version: string | null;
}

interface WorkersTableProps {
	initialWorkers: Worker[];
}

function getRegionFlag(location: string) {
	if (location.startsWith("eu-")) return <EU className="h-3 w-4" />;
	if (location.startsWith("us-")) return <US className="h-3 w-4" />;
	if (location.startsWith("na-")) return <CA className="h-3 w-4" />;
	if (location.startsWith("ca-")) return <CA className="h-3 w-4" />; // Canada explicit
	if (location.startsWith("sa-")) return <BR className="h-3 w-4" />;
	if (location.startsWith("br-")) return <BR className="h-3 w-4" />; // Brazil explicit
	if (location.startsWith("af-")) return <ZA className="h-3 w-4" />;
	if (location.startsWith("ap-")) return <HK className="h-3 w-4" />; // Changed generalized AP to HK for now based on req, or logic
	if (location.startsWith("au-")) return <AU className="h-3 w-4" />;
	return <AQ className="h-3 w-4" />;
}

export function WorkersTable({ initialWorkers }: WorkersTableProps) {
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="font-bold text-2xl tracking-tight">Workers</h1>
				<div className="flex items-center gap-2">
					<div className="relative w-64">
						<Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
						<Input placeholder="Search" className="pl-8" />
					</div>
					<CreateWorkerDialog />
				</div>
			</div>

			<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
				<div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-3 font-medium text-muted-foreground text-sm">
					<ChevronDown className="h-4 w-4" />
					Workers
				</div>
				<Table>
					<TableBody>
						{initialWorkers.length === 0 ? (
							<TableRow>
								<TableCell colSpan={4} className="h-24 text-center">
									<div className="flex flex-col items-center justify-center gap-2 py-6">
										<div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
											<Search className="h-6 w-6 text-muted-foreground" />
										</div>
										<p className="font-medium text-lg">No workers found</p>
										<p className="text-muted-foreground text-sm">
											Get started by adding your first worker.
										</p>
										<div className="mt-2">
											<CreateWorkerDialog />
										</div>
									</div>
								</TableCell>
							</TableRow>
						) : (
							initialWorkers.map((worker) => (
								<TableRow
									key={worker.id}
									className="group h-[72px] cursor-pointer hover:bg-muted/40"
								>
									<TableCell className="w-[50px] pl-6">
										<div
											className={cn(
												"h-2.5 w-2.5 rounded-full shadow-sm",
												!worker.lastHeartbeat &&
													"bg-gray-400 shadow-gray-400/20",
												worker.lastHeartbeat &&
													worker.active &&
													"bg-emerald-500 shadow-emerald-500/20",
												worker.lastHeartbeat &&
													!worker.active &&
													"bg-red-500 shadow-red-500/20",
											)}
										/>
									</TableCell>
									<TableCell>
										<div className="grid gap-1">
											<span className="flex items-center gap-2 font-semibold leading-none transition-colors group-hover:text-primary">
												{worker.name}
												<span className="ml-2 rounded border px-1 font-normal text-muted-foreground text-xs">
													{worker.version}
												</span>
											</span>
											<div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
												<span
													className={cn(
														!worker.lastHeartbeat && "text-gray-500",
														worker.lastHeartbeat &&
															worker.active &&
															"text-emerald-500",
														worker.lastHeartbeat &&
															!worker.active &&
															"text-red-500",
													)}
												>
													{!worker.lastHeartbeat
														? "Unknown"
														: worker.active
															? "Online"
															: "Offline"}
												</span>
												<span>·</span>
												<span className="flex items-center gap-1.5 align-middle">
													{getRegionFlag(worker.location)}
													{worker.location}
												</span>
												<span>·</span>
												<span>
													Last seen{" "}
													{worker.lastHeartbeat
														? formatDistanceToNow(
																new Date(worker.lastHeartbeat),
																{
																	addSuffix: true,
																},
															)
														: "Never"}
												</span>
											</div>
										</div>
									</TableCell>
									<TableCell className="w-[200px] text-right font-medium text-sm text-muted-foreground" />
									<TableCell className="w-[50px] pr-4">
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
													<Link href={`/admin/workers/${worker.id}`}>
														Edit worker
													</Link>
												</DropdownMenuItem>
												<DropdownMenuItem>Rotate Token</DropdownMenuItem>
												<DropdownMenuItem className="text-red-500">
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
			</div>
		</div>
	);
}
