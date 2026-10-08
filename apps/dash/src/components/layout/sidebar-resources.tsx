"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSkeleton,
    SidebarSeparator,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

const SIDEBAR_MONITOR_LIMIT = 8;
const SIDEBAR_INCIDENT_LIMIT = 5;
const SIDEBAR_REFETCH_INTERVAL = 60_000;

const monitorStatusDotClasses: Record<string, string> = {
    up: "bg-emerald-500",
    down: "bg-red-500",
    degraded: "bg-amber-500",
    maintenance: "bg-blue-500",
    pending: "bg-zinc-500",
};

const incidentSeverityDotClasses: Record<string, string> = {
    minor: "bg-amber-500",
    major: "bg-orange-500",
    critical: "bg-red-500",
    maintenance: "bg-blue-500",
};

function StatusDot({ className }: { className?: string }) {
    return (
        <span className="flex size-4 shrink-0 items-center justify-center">
            <span
                className={cn("size-2 rounded-full bg-zinc-500", className)}
            />
        </span>
    );
}

function SidebarListSkeleton({ rows }: { rows: number }) {
    return Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
        <SidebarMenuItem key={index}>
            <SidebarMenuSkeleton showIcon />
        </SidebarMenuItem>
    ));
}

function ViewAllItem({ href, total }: { href: string; total: number }) {
    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                size="sm"
                className="text-muted-foreground"
                render={
                    <Link href={href as any}>
                        <span>View all ({total})</span>
                    </Link>
                }
            />
        </SidebarMenuItem>
    );
}

export function SidebarActiveIncidents() {
    const pathname = usePathname();
    const { data } = useQuery({
        ...orpc.incidents.list.queryOptions({
            input: { status: "open", limit: SIDEBAR_INCIDENT_LIMIT },
        }),
        refetchInterval: SIDEBAR_REFETCH_INTERVAL,
    });

    if (!data || data.items.length === 0) return null;

    return (
        <>
            <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />
            <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                <SidebarGroupLabel>Active Incidents</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        {data.items.map((incident) => {
                            const href = `/incidents/${incident.id}`;
                            return (
                                <SidebarMenuItem key={incident.id}>
                                    <SidebarMenuButton
                                        isActive={pathname === href}
                                        tooltip={incident.title}
                                        render={
                                            <Link href={href as any}>
                                                <StatusDot
                                                    className={cn(
                                                        incidentSeverityDotClasses[
                                                            incident.severity
                                                        ],
                                                        "animate-pulse",
                                                    )}
                                                />
                                                <span>{incident.title}</span>
                                            </Link>
                                        }
                                    />
                                </SidebarMenuItem>
                            );
                        })}
                        {data.total > data.items.length && (
                            <ViewAllItem href="/" total={data.total} />
                        )}
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        </>
    );
}

export function SidebarMonitors() {
    const pathname = usePathname();
    const { data, isPending } = useQuery({
        ...orpc.monitors.list.queryOptions({
            input: { limit: SIDEBAR_MONITOR_LIMIT },
        }),
        refetchInterval: SIDEBAR_REFETCH_INTERVAL,
    });

    if (!isPending && (!data || data.items.length === 0)) return null;

    return (
        <>
            <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />
            <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                <SidebarGroupLabel>Monitors</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        {isPending ? (
                            <SidebarListSkeleton rows={3} />
                        ) : (
                            data?.items.map((monitor) => {
                                const href = `/monitors/${monitor.id}`;
                                const dotClass =
                                    monitor.type === "instatus"
                                        ? "bg-purple-500"
                                        : monitorStatusDotClasses[
                                              monitor.status
                                          ];
                                return (
                                    <SidebarMenuItem key={monitor.id}>
                                        <SidebarMenuButton
                                            isActive={pathname.startsWith(href)}
                                            tooltip={monitor.name}
                                            className={cn(
                                                !monitor.active &&
                                                    "text-muted-foreground",
                                            )}
                                            render={
                                                <Link href={href as any}>
                                                    <StatusDot
                                                        className={cn(
                                                            dotClass,
                                                            !monitor.active &&
                                                                "opacity-50",
                                                        )}
                                                    />
                                                    <span>{monitor.name}</span>
                                                </Link>
                                            }
                                        />
                                    </SidebarMenuItem>
                                );
                            })
                        )}
                        {data && data.total > data.items.length && (
                            <ViewAllItem href="/monitors" total={data.total} />
                        )}
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        </>
    );
}
