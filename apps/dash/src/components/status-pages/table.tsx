"use client";

import {
	Table,
	TableBody,
	TableCell,
	TableRow,
} from "@/components/ui/table";
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
    Globe,
    ExternalLink,
    BarChart,
    Lock
} from "lucide-react";

import Link from "next/link";

type StatusPageStatus = "published" | "draft" | "maintenance";

interface StatusPage {
	id: string;
	name: string;
	slug: string;
    customDomain?: string;
	status: StatusPageStatus;
    monitorsCount: number;
    subscribers: number;
    isPrivate: boolean;
}

const statusPages: StatusPage[] = [
    {
		id: "1",
		name: "Public Status Page",
        slug: "status",
        customDomain: "status.uptimekit.com",
		status: "published",
        monitorsCount: 12,
        subscribers: 145,
        isPrivate: false,
	},
	{
		id: "2",
		name: "Internal Operations",
        slug: "ops",
        status: "maintenance",
        monitorsCount: 5,
        subscribers: 23,
        isPrivate: true,
	},
	{
		id: "3",
		name: "Customer Portal",
        slug: "portal-status",
        status: "draft",
        monitorsCount: 3,
        subscribers: 0,
        isPrivate: false,
	},
];

export function StatusPagesTable() {
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold tracking-tight">Status Pages</h1>
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
						Create status page
					</Button>
				</div>
			</div>

			<div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center gap-2 text-sm font-medium text-muted-foreground bg-muted/20">
                    <ChevronDown className="h-4 w-4" />
                    Status Pages
                </div>
				<Table>
					<TableBody>
						{statusPages.map((page) => (
							<TableRow key={page.id} className="group cursor-pointer hover:bg-muted/40 h-[72px]">
								<TableCell className="pl-6">
									<div className="grid gap-1">
										<span className="font-semibold leading-none group-hover:text-primary transition-colors flex items-center gap-2">
											{page.name}
                                            {page.isPrivate && <Lock className="h-3 w-3 text-muted-foreground" />}
										</span>
										<div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                            <span className="flex items-center gap-1">
                                                {page.customDomain || `uptimekit.com/s/${page.slug}`}
                                                <ExternalLink className="h-3 w-3 opacity-50" />
                                            </span>
										</div>
									</div>
								</TableCell>
                                <TableCell className="w-[200px]">
                                     <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1.5" title="Monitors">
                                            <Globe className="h-4 w-4 opacity-70" />
                                            <span>{page.monitorsCount}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5" title="Subscribers">
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
												className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
											>
												<MoreHorizontal className="h-4 w-4" />
												<span className="sr-only">Open menu</span>
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
                                            <DropdownMenuItem asChild>
                                                <Link href={`/s/${page.slug}` as any} target="_blank">
                                                    View page
                                                </Link>
                                            </DropdownMenuItem>
											<DropdownMenuItem>Edit page</DropdownMenuItem>
											<DropdownMenuItem>Theme settings</DropdownMenuItem>
                                            <DropdownMenuItem>Subscribers</DropdownMenuItem>
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
