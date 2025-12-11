"use client";

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	MoreHorizontal,
	Search,
	Filter,
    Plus,
    ChevronDown,
    ShieldAlert,
    ChevronRight,
    PlayCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

type MonitorStatus = "up" | "down" | "degraded" | "maintenance";

interface Monitor {
	id: string;
	name: string;
	url: string;
	status: MonitorStatus;
	statusText: string;
    duration: string;
    usedOn: number;
    frequency: string;
    hasIncident?: boolean;
}

const monitors: Monitor[] = [
    {
		id: "1",
		name: "api.cortano.cloud",
        url: "https://api.cortano.cloud",
		status: "up",
        statusText: "Online",
        duration: "14d 2h 10m",
        usedOn: 2,
        frequency: "1m",
        hasIncident: false,
	},
	{
		id: "2",
		name: "premium-pl1.cortano.cloud",
        url: "https://premium-pl1.cortano.cloud",
		status: "down",
        statusText: "Down",
        duration: "28d 13h 34m",
        usedOn: 1,
        frequency: "3m",
        hasIncident: true,
	},
	{
		id: "3",
		name: "legacy-api.cortano.cloud",
        url: "https://legacy-api.cortano.cloud",
		status: "degraded",
        statusText: "Degraded Performance",
        duration: "3d 19h 15m",
        usedOn: 1,
        frequency: "3m",
        hasIncident: false,
	},
    {
		id: "4",
		name: "cdn.cortano.cloud",
        url: "https://cdn.cortano.cloud",
		status: "maintenance",
        statusText: "Maintenance",
        duration: "1h 5m",
        usedOn: 4,
        frequency: "30s",
        hasIncident: false,
	},
];

export function MonitorsTable() {
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold tracking-tight">Monitors</h1>
				<div className="flex items-center gap-2">
					<div className="relative w-64">
						<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input placeholder="Search" className="pl-8" />
					</div>
					<Button variant="outline" size="icon">
						<Filter className="h-4 w-4" />
					</Button>
					<Button className="gap-2 bg-white text-black hover:bg-gray-100 border-none shadow-md shadow-white/10">
                        <Plus className="h-4 w-4" />
						Create monitor
					</Button>
				</div>
			</div>

			<div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center gap-2 text-sm font-medium text-muted-foreground bg-muted/20">
                    <ChevronDown className="h-4 w-4" />
                    Monitors
                </div>
				<Table>
					<TableBody>
						{monitors.map((monitor) => (
							<TableRow key={monitor.id} className="group cursor-pointer hover:bg-muted/40 h-[72px]">
								<TableCell className="w-[50px] pl-6">
                                    <div className={cn(
                                        "h-2.5 w-2.5 rounded-full shadow-sm",
                                        monitor.status === "up" && "bg-emerald-500 shadow-emerald-500/20",
                                        monitor.status === "down" && "bg-red-500 shadow-red-500/20",
                                        monitor.status === "degraded" && "bg-amber-500 shadow-amber-500/20",
                                        monitor.status === "maintenance" && "bg-blue-500 shadow-blue-500/20",
                                    )} />
								</TableCell>
								<TableCell>
									<div className="grid gap-1">
										<span className="font-semibold leading-none group-hover:text-primary transition-colors flex items-center gap-2">
											{monitor.name}
										</span>
										<div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                            <span className={cn(
                                                 monitor.status === "up" && "text-emerald-500",
                                                 monitor.status === "down" && "text-red-500",
                                                 monitor.status === "degraded" && "text-amber-500",
                                                 monitor.status === "maintenance" && "text-blue-500"
                                            )}>{monitor.statusText}</span>
                                            <span>·</span>
                                            <span>{monitor.duration}</span>
                                            <span>·</span>
                                            <span className="underline decoration-dashed decoration-muted-foreground/50 underline-offset-2 hover:text-foreground transition-colors">Used on {monitor.usedOn} status page{monitor.usedOn !== 1 ? 's' : ''}</span>
										</div>
									</div>
								</TableCell>
                                <TableCell className="w-[200px]">
                                    {monitor.hasIncident && (
                                        <div className="inline-flex items-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-500">
                                            <ShieldAlert className="h-3.5 w-3.5" />
                                            Ongoing Incident
                                            <ChevronRight className="ml-1 h-3 w-3 opacity-50" />
                                        </div>
                                    )}
                                </TableCell>
								<TableCell className="text-muted-foreground text-sm font-medium w-[100px]">
									<div className="flex items-center gap-2">
                                        <PlayCircle className="h-4 w-4 opacity-50" />
                                        {monitor.frequency}
                                    </div>
								</TableCell>
								<TableCell className="w-[50px] pr-4">
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
											>
												<MoreHorizontal className="h-4 w-4" />
												<span className="sr-only">Open menu</span>
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem>View details</DropdownMenuItem>
											<DropdownMenuItem>Edit monitor</DropdownMenuItem>
                                            <DropdownMenuItem>Pause monitoring</DropdownMenuItem>
                                            <DropdownMenuItem className="text-red-500">Delete</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
