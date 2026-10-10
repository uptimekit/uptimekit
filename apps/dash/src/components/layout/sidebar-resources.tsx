"use client";

import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    SidebarGroup,
    SidebarGroupAction,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSkeleton,
    SidebarSeparator,
    useSidebar,
} from "@/components/ui/sidebar";
import { useHydrated } from "@/hooks/use-hydrated";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

const SIDEBAR_MONITOR_LIMIT = 8;
const SIDEBAR_INCIDENT_LIMIT = 5;
const SIDEBAR_REFETCH_INTERVAL = 60_000;

const healthDotClasses: Record<string, string> = {
    up: "bg-emerald-500",
    degraded: "bg-amber-500",
    down: "bg-red-500",
};

const incidentSeverityHealth: Record<string, string> = {
    minor: "degraded",
    major: "down",
    critical: "down",
};

/**
 * The resource queries are organization-scoped and only worth polling while the
 * sections are actually visible, i.e. not hidden by the icon-collapsed sidebar.
 */
function useSidebarResourcesEnabled() {
    const isMounted = useHydrated();
    const { state, isMobile, openMobile } = useSidebar();
    const { data: activeOrg } = authClient.useActiveOrganization();
    const isVisible = isMobile ? openMobile : state === "expanded";

    return isMounted && Boolean(activeOrg?.id) && isVisible;
}

function StatusDot({ className }: { className?: string }) {
    return (
        <span className="flex size-4 shrink-0 items-center justify-center">
            <span
                className={cn(
                    "size-2 rounded-full bg-muted-foreground/40",
                    className,
                )}
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

function CreateAction({ href, label }: { href: string; label: string }) {
    return (
        <SidebarGroupAction
            title={label}
            aria-label={label}
            render={
                <Link href={href as any}>
                    <FontAwesomeIcon icon={faPlus} className="size-3!" />
                </Link>
            }
        />
    );
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
    const enabled = useSidebarResourcesEnabled();
    const { data } = useQuery({
        ...orpc.incidents.list.queryOptions({
            input: { status: "open", limit: SIDEBAR_INCIDENT_LIMIT },
        }),
        enabled,
        refetchInterval: SIDEBAR_REFETCH_INTERVAL,
    });

    if (!enabled || !data || data.items.length === 0) return null;

    return (
        <>
            <SidebarSeparator />
            <SidebarGroup>
                <SidebarGroupLabel>Active Incidents</SidebarGroupLabel>
                <CreateAction href="/incidents/new" label="New incident" />
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
                                                        healthDotClasses[
                                                            incidentSeverityHealth[
                                                                incident
                                                                    .severity
                                                            ] ?? ""
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
    const enabled = useSidebarResourcesEnabled();
    const { data, isPending } = useQuery({
        ...orpc.monitors.list.queryOptions({
            input: { limit: SIDEBAR_MONITOR_LIMIT },
        }),
        enabled,
        refetchInterval: SIDEBAR_REFETCH_INTERVAL,
    });

    if (!enabled || (!isPending && (!data || data.items.length === 0))) {
        return null;
    }

    return (
        <>
            <SidebarSeparator />
            <SidebarGroup>
                <SidebarGroupLabel>Monitors</SidebarGroupLabel>
                <CreateAction href="/monitors/new" label="New monitor" />
                <SidebarGroupContent>
                    <SidebarMenu>
                        {isPending ? (
                            <SidebarListSkeleton rows={3} />
                        ) : (
                            data?.items.map((monitor) => {
                                const href = `/monitors/${monitor.id}`;
                                const dotClass =
                                    healthDotClasses[monitor.status];
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
