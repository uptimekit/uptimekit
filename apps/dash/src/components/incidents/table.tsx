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
	ShieldAlert,
	CheckCircle2,
    Plus,
    ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";

type IncidentStatus = "ongoing" | "resolved";

interface Incident {
	id: string;
	name: string;
	message: string;
	startedAt: string;
	duration: string;
	status: IncidentStatus;
}

const incidents: Incident[] = [
	{
		id: "1",
		name: "free-pl1.cortano.cloud",
		message: "Unexpected HTTP status code",
		startedAt: "3 days ago",
		duration: "Ongoing",
		status: "ongoing",
	},
	{
		id: "2",
		name: "premium-pl1.cortano.cloud",
		message: "Unexpected HTTP status code",
		startedAt: "Nov 12 at 9:55pm CET",
		duration: "Ongoing",
		status: "ongoing",
	},
	{
		id: "3",
		name: "free-pl1.cortano.cloud",
		message: "Unexpected HTTP status code",
		startedAt: "1 week ago",
		duration: "5 minutes",
		status: "resolved",
	},
	{
		id: "4",
		name: "free-pl1.cortano.cloud",
		message: "Timeout (no headers received)",
		startedAt: "1 week ago",
		duration: "2 minutes",
		status: "resolved",
	},
    {
		id: "5",
		name: "api.cortano.cloud",
		message: "Connection refused",
		startedAt: "Nov 25 at 10:49pm CET",
		duration: "17 minutes",
		status: "resolved",
	},
    {
		id: "6",
		name: "auth.cortano.cloud",
		message: "Timeout (> 5000ms)",
		startedAt: "Nov 23 at 7:14pm CET",
		duration: "5 minutes",
		status: "resolved",
	},
];

export function IncidentsTable() {
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold tracking-tight">Incidents</h1>
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
						Report a new incident
					</Button>
				</div>
			</div>

			<div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center gap-2 text-sm font-medium text-muted-foreground bg-muted/20">
                    <ChevronDown className="h-4 w-4" />
                    Incidents
                </div>
				<Table>
					<TableBody>
						{incidents.map((incident) => (
							<TableRow key={incident.id} className="group cursor-pointer hover:bg-muted/40 h-[72px]">
								<TableCell className="pl-6">
									<div className="flex items-start gap-4">
										<div className={cn(
                                            "mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
                                            incident.status === "ongoing" 
                                                ? "bg-red-500/10 border-red-500/20 text-red-500" 
                                                : "bg-muted/50 border-muted text-muted-foreground"
                                        )}>
											{incident.status === "ongoing" ? (
												<ShieldAlert className="h-5 w-5" />
											) : (
												<CheckCircle2 className="h-5 w-5" />
											)}
										</div>
										<div className="grid gap-1">
											<span className="font-semibold leading-none group-hover:text-primary transition-colors">
												{incident.name}
											</span>
											<span className="text-sm text-muted-foreground">
												{incident.message}
											</span>
										</div>
									</div>
								</TableCell>
								<TableCell className="text-muted-foreground text-sm font-medium">
									{incident.startedAt}
								</TableCell>
								<TableCell>
									<div className="flex items-center gap-2">
										<div
											className={cn(
												"h-2 w-2 rounded-full",
												incident.status === "ongoing"
													? "bg-red-500 animate-pulse"
													: "bg-muted-foreground/30"
											)}
										/>
										<span className={cn(
                                            "text-sm font-medium",
                                            incident.status === "ongoing" ? "text-red-500" : "text-muted-foreground"
                                        )}>
											{incident.duration}
										</span>
									</div>
								</TableCell>
								<TableCell>
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
											<DropdownMenuItem>Edit incident</DropdownMenuItem>
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
