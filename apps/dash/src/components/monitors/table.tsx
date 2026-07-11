"use client";

import {
    faArrowRight,
    faBomb,
    faCheck,
    faChevronDown,
    faChevronRight,
    faCirclePlay,
    faEdit,
    faEllipsis,
    faEye,
    faFilter,
    faFolder,
    faMagnifyingGlass,
    faPause,
    faPlay,
    faPlus,
    faServer,
    faShieldHalved,
    faSpinner,
    faTrash,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
    parseAsBoolean,
    parseAsString,
    parseAsStringEnum,
    useQueryStates,
} from "nuqs";
import { Fragment, type ReactNode, useEffect, useState } from "react";
import { sileo } from "sileo";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuGroupLabel,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { getRegionInfo, isFontAwesomeRegionFlag } from "@/lib/regions";
import { cn } from "@/lib/utils";
import { client, orpc } from "@/utils/orpc";
import { GroupCreationDialog } from "./group-creation-dialog";
import {
    buildGroupPaths,
    buildGroupTree,
    type GroupNodeInput,
    type GroupTreeNode,
} from "./group-tree";
import { LatencySparkline } from "./latency-sparkline";
import { TagCreationDialog } from "./tag-creation-dialog";

// Monitors load on one page (no pagination) so a group's members never split
// across pages; beyond this the table shows a "first N of M" notice, not silence.
const MONITOR_LIST_LIMIT = 1000;
const MONITOR_STATUS_FILTERS = [
    "up",
    "down",
    "degraded",
    "maintenance",
] as const;
const MONITOR_TYPE_FILTERS = ["http", "ping", "tcp", "dns", "keyword"] as const;

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
    statusReason?: string | null;
    duration: string;
    usedOn: number;
    frequency: string;
    type: string;
    hasIncident: boolean;
    activeIncidentId?: string | null;
    active: boolean;
    pauseReason?: string | null;
    tags?: Array<{ id: string; name: string; color: string }>;
}

function getPauseLabel(pauseReason?: string | null) {
    switch (pauseReason) {
        case "org_active_monitor_limit":
            return "PAUSED BY MONITOR LIMIT";
        case "org_region_limit":
            return "PAUSED BY REGION LIMIT";
        case "worker_deleted":
            return "PAUSED BY WORKER REMOVAL";
        default:
            return "PAUSED";
    }
}

/**
 * Render the monitors list view with search, filters, grouping, and pagination.
 *
 * Displays a searchable, filterable, and paginated table of monitors with group
 * collapse/expand, tag badges, latency sparklines, and per-monitor actions.
 *
 * @returns The React element for the monitors management UI.
 */
function useMonitorsTableModel() {
    const [searchOpen, setSearchOpen] = useState(false);
    const [groupsOpen, setGroupsOpen] = useState(false);
    const [tagsOpen, setTagsOpen] = useState(false);
    const [filters, setFilters] = useQueryStates({
        search: parseAsString.withDefault(""),
        active: parseAsBoolean,
        type: parseAsStringEnum([...MONITOR_TYPE_FILTERS]),
        status: parseAsStringEnum([...MONITOR_STATUS_FILTERS]),
        groupId: parseAsString,
        tagId: parseAsString,
    });
    const {
        search,
        active: activeFilter,
        type: typeFilter,
        status: statusFilter,
        groupId: groupFilter,
        tagId: tagFilter,
    } = filters;
    const [expandedGroups, setExpandedGroups] = useState<
        Record<string, boolean>
    >({});
    const [selectedMonitorIds, setSelectedMonitorIds] = useState<Set<string>>(
        () => new Set(),
    );
    const [previousMonitorScope, setPreviousMonitorScope] = useState("");
    const [assignWorkerOpen, setAssignWorkerOpen] = useState(false);

    // Debounce search
    const [searchInput, setSearchInput] = useState(search);
    const [previousSearch, setPreviousSearch] = useState(search);
    const [debouncedSearch, setDebouncedSearch] = useState(search);
    if (search !== previousSearch) {
        setPreviousSearch(search);
        setSearchInput(search);
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchInput);
            if (searchInput !== search) {
                void setFilters({
                    search: searchInput || null,
                });
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchInput, setFilters, search]);

    const { data, isLoading } = useQuery({
        ...orpc.monitors.list.queryOptions({
            input: {
                q: debouncedSearch || undefined,
                active: activeFilter ?? undefined,
                type: typeFilter ?? undefined,
                status: statusFilter ?? undefined,
                groupId: groupFilter ?? undefined,
                tagId: tagFilter ?? undefined,
                limit: MONITOR_LIST_LIMIT,
                offset: 0,
            },
        }),
        refetchInterval: 60_000,
    });

    // Fetch groups and tags for filters
    const { data: groups } = useQuery({
        ...orpc.monitors.listGroups.queryOptions(),
    });

    const { data: tags } = useQuery({
        ...orpc.monitors.listTags.queryOptions(),
    });

    // Fetch latency sparkline data for all visible monitors
    const monitorIds = data?.items?.map((m) => m.id) ?? [];
    const { data: sparklineData } = useQuery({
        ...orpc.monitors.getBatchLatencySparkline.queryOptions({
            input: { monitorIds },
        }),
        enabled: monitorIds.length > 0,
        refetchInterval: 60_000,
    });

    const monitors = data?.items;
    const total = data?.total ?? 0;
    const isCapped = total > MONITOR_LIST_LIMIT;

    const tableData: (Monitor & { groupId?: string })[] =
        monitors?.map((m) => ({
            id: m.id,
            name: m.name,
            url: (m.config as { url: string }).url || "",
            status: (m as any).status || "pending",
            statusText:
                (m as any).status === "up"
                    ? "Operational"
                    : (m as any).status === "down"
                      ? "Downtime"
                      : (m as any).status === "degraded"
                        ? "Degraded"
                        : (m as any).status === "maintenance"
                          ? "Maintenance"
                          : "Pending",
            statusReason: (m as any).statusReason ?? null,
            type: (m as any).type ?? null,
            duration: ((monitor: any) => {
                if (monitor.status === "up") {
                    if (monitor.lastStatusChange) {
                        return formatDistanceToNow(
                            new Date(monitor.lastStatusChange),
                        );
                    }
                    if (monitor.createdAt) {
                        return formatDistanceToNow(new Date(monitor.createdAt));
                    }
                } else if (monitor.lastStatusChange) {
                    return formatDistanceToNow(
                        new Date(monitor.lastStatusChange),
                    );
                }
                return "0s";
            })(m),
            usedOn: (m as any).usedOn || 0,
            frequency: `${m.interval}s`,
            hasIncident: Boolean((m as any).activeIncidentId),
            activeIncidentId: (m as any).activeIncidentId ?? null,
            active: m.active,
            pauseReason: (m as any).pauseReason,
            tags: (m as any).tags || [],
            groupId: (m as any).groupId,
        })) ?? [];

    const monitorsByGroup = tableData.reduce(
        (acc, monitor) => {
            const groupId = monitor.groupId || "ungrouped";
            if (!acc[groupId]) {
                acc[groupId] = [];
            }
            acc[groupId].push(monitor);
            return acc;
        },
        {} as Record<string, (Monitor & { groupId?: string })[]>,
    );

    const groupTree = buildGroupTree(groups);
    const groupPaths = buildGroupPaths(groups);

    const countSubtreeMonitors = (
        node: GroupTreeNode<GroupNodeInput>,
    ): number => {
        let count = monitorsByGroup[node.group.id]?.length ?? 0;
        for (const child of node.children) {
            count += countSubtreeMonitors(child);
        }
        return count;
    };

    const toggleGroup = (groupId: string) => {
        setExpandedGroups((prev) => ({
            ...prev,
            [groupId]: !(prev[groupId] ?? true),
        }));
    };

    const ungroupedMonitors = monitorsByGroup.ungrouped ?? [];

    const allMonitorIds = tableData.map((m) => m.id);
    const monitorScope = allMonitorIds.join(",");
    if (monitorScope !== previousMonitorScope) {
        setPreviousMonitorScope(monitorScope);
        setSelectedMonitorIds(new Set());
    }
    const selectedIds = allMonitorIds.filter((id) =>
        selectedMonitorIds.has(id),
    );
    const selectedCount = selectedIds.length;
    const allSelected =
        allMonitorIds.length > 0 &&
        allMonitorIds.every((id) => selectedMonitorIds.has(id));
    const someSelected =
        allMonitorIds.length > 0 &&
        allMonitorIds.some((id) => selectedMonitorIds.has(id));

    const toggleMonitorSelection = (id: string, checked: boolean) => {
        setSelectedMonitorIds((previous) => {
            const next = new Set(previous);
            if (checked) {
                next.add(id);
            } else {
                next.delete(id);
            }
            return next;
        });
    };

    const toggleSelectAll = (checked: boolean) => {
        setSelectedMonitorIds(checked ? new Set(allMonitorIds) : new Set());
    };

    const clearSelection = () => setSelectedMonitorIds(new Set());

    const renderMonitorRow = (
        monitor: Monitor & { groupId?: string },
        depth: number,
    ) => (
        <TableRow
            key={monitor.id}
            className={cn(
                "group relative h-[72px] cursor-pointer hover:bg-muted/40",
                !monitor.active && "opacity-50 grayscale",
            )}
            data-state={
                selectedMonitorIds.has(monitor.id) ? "selected" : undefined
            }
        >
            <TableCell
                className="relative z-20 w-10 pr-0 pl-4"
                onClick={(e) => e.stopPropagation()}
            >
                <Checkbox
                    aria-label={`Select ${monitor.name}`}
                    checked={selectedMonitorIds.has(monitor.id)}
                    onCheckedChange={(checked) =>
                        toggleMonitorSelection(monitor.id, checked === true)
                    }
                />
            </TableCell>

            <TableCell
                className="relative"
                style={{ paddingLeft: 8 + (depth - 0.2) * 16 }}
            >
                <Link
                    href={`/monitors/${monitor.id}`}
                    className="absolute inset-0 z-0"
                    aria-label={`Open ${monitor.name}`}
                />

                <div className="pointer-events-none relative z-10 flex items-center gap-3">
                    <div
                        className={cn(
                            "h-2.5 w-2.5 shrink-0 rounded-full shadow-sm",
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
                            monitor.type === "instatus" &&
                                "bg-purple-500 shadow-purple-500/20",
                        )}
                    />

                    <div className="grid gap-1">
                        <span className="flex items-center gap-2 font-semibold leading-none transition-colors group-hover:text-primary">
                            {monitor.name}

                            {!monitor.active && (
                                <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-[10px] text-muted-foreground">
                                    {getPauseLabel(monitor.pauseReason)}
                                </span>
                            )}

                            {monitor.tags && monitor.tags.length > 0 && (
                                <div className="flex items-center gap-1">
                                    {monitor.tags.map((tag) => (
                                        <span
                                            key={tag.id}
                                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-[10px]"
                                            style={{
                                                backgroundColor: `${tag.color}20`,
                                                color: tag.color,
                                            }}
                                        >
                                            {tag.name}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </span>

                        <div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
                            <span
                                className={cn(
                                    monitor.status === "up" &&
                                        "text-emerald-500",
                                    monitor.status === "down" && "text-red-500",
                                    monitor.status === "degraded" &&
                                        "text-amber-500",
                                    monitor.status === "maintenance" &&
                                        "text-blue-500",
                                    monitor.status === "pending" &&
                                        "text-zinc-500",
                                    monitor.type === "instatus" &&
                                        "text-purple-500",
                                )}
                            >
                                {monitor.type === "instatus"
                                    ? "External"
                                    : monitor.statusText}
                            </span>
                            {!(monitor.type === "instatus") && (
                                <>
                                    <span>·</span>
                                    <span>{monitor.duration}</span>
                                </>
                            )}
                            <span>·</span>
                            <span className="underline decoration-muted-foreground/50 decoration-dashed underline-offset-2 transition-colors hover:text-foreground">
                                Used on {monitor.usedOn} status page
                                {monitor.usedOn !== 1 ? "s" : ""}
                            </span>
                            {monitor.status === "degraded" &&
                                monitor.statusReason && (
                                    <>
                                        <span>·</span>
                                        <span className="max-w-[320px] truncate text-amber-500">
                                            {monitor.statusReason}
                                        </span>
                                    </>
                                )}
                        </div>
                    </div>
                </div>
            </TableCell>

            <TableCell className="relative w-[200px]">
                <Link
                    href={`/monitors/${monitor.id}`}
                    className="absolute inset-0 z-0"
                    aria-label={`Open ${monitor.name}`}
                />

                {monitor.hasIncident && (
                    <div className="pointer-events-none relative z-10 inline-flex items-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/10 px-2.5 py-1 font-medium text-red-500 text-xs">
                        <FontAwesomeIcon
                            icon={faShieldHalved}
                            className="h-3.5 w-3.5"
                        />
                        Ongoing Incident
                        <FontAwesomeIcon
                            icon={faChevronRight}
                            className="ml-1 h-3 w-3 opacity-50"
                        />
                    </div>
                )}
            </TableCell>

            <TableCell
                className="relative w-[100px] font-medium text-muted-foreground text-sm"
                hidden={monitor.type === "instatus"}
            >
                <Link
                    href={`/monitors/${monitor.id}`}
                    className="absolute inset-0 z-0"
                    aria-label={`Open ${monitor.name}`}
                />

                <div className="pointer-events-none relative z-10 flex items-center gap-2">
                    <FontAwesomeIcon
                        icon={faCirclePlay}
                        className="h-4 w-4 opacity-50"
                    />
                    {monitor.frequency}
                </div>
            </TableCell>

            <TableCell className="relative z-20 w-[50px]">
                <MonitorActions monitor={monitor} />
            </TableCell>

            <TableCell className="relative hidden h-[72px] w-[140px] p-0 lg:table-cell">
                <Link
                    href={`/monitors/${monitor.id}`}
                    className="absolute inset-0 z-10"
                    aria-label={`Open ${monitor.name}`}
                />

                <div
                    className="pointer-events-none absolute inset-0 z-20"
                    hidden={monitor.type === "instatus"}
                >
                    <LatencySparkline
                        data={sparklineData?.[monitor.id] ?? []}
                    />
                </div>
            </TableCell>
        </TableRow>
    );

    const renderGroupNode = (
        node: GroupTreeNode<GroupNodeInput>,
    ): ReactNode[] => {
        const subtreeCount = countSubtreeMonitors(node);
        if (subtreeCount === 0) return [];

        const isExpanded = expandedGroups[node.group.id] ?? true;
        const directMonitors = monitorsByGroup[node.group.id] ?? [];
        const rows: ReactNode[] = [];

        rows.push(
            <TableRow
                key={`group-${node.group.id}`}
                className="cursor-pointer border-b bg-muted/10 hover:bg-muted/20"
                onClick={() => toggleGroup(node.group.id)}
            >
                <TableCell colSpan={6} className="py-3">
                    <div
                        className="flex select-none items-center gap-2 font-medium text-sm"
                        style={{ marginLeft: node.depth * 16 }}
                    >
                        <FontAwesomeIcon
                            icon={faChevronRight}
                            className={cn(
                                "h-4 w-4 transition-transform",
                                isExpanded && "rotate-90",
                            )}
                        />
                        <FontAwesomeIcon
                            icon={faFolder}
                            className="h-4 w-4 text-muted-foreground"
                        />
                        <span>{node.group.name}</span>
                        <span className="text-muted-foreground text-xs">
                            ({subtreeCount})
                        </span>
                    </div>
                </TableCell>
            </TableRow>,
        );

        if (isExpanded) {
            for (const child of node.children) {
                rows.push(...renderGroupNode(child));
            }
            for (const monitor of directMonitors) {
                rows.push(renderMonitorRow(monitor, node.depth + 1));
            }
        }

        return rows;
    };

    const clearFilters = () => {
        setSearchInput("");
        void setFilters({
            search: null,
            active: null,
            type: null,
            status: null,
            groupId: null,
            tagId: null,
        });
    };

    const activeFilterCount = [
        activeFilter !== null,
        typeFilter !== null,
        statusFilter !== null,
        groupFilter !== null,
        tagFilter !== null,
    ].filter(Boolean).length;

    return {
        searchOpen,
        setSearchOpen,
        groupsOpen,
        setGroupsOpen,
        tagsOpen,
        setTagsOpen,
        filters,
        setFilters,
        search,
        activeFilter,
        typeFilter,
        statusFilter,
        groupFilter,
        tagFilter,
        expandedGroups,
        setExpandedGroups,
        selectedMonitorIds,
        setSelectedMonitorIds,
        previousMonitorScope,
        setPreviousMonitorScope,
        assignWorkerOpen,
        setAssignWorkerOpen,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        data,
        isLoading,
        groups,
        tags,
        monitorIds,
        sparklineData,
        monitors,
        total,
        isCapped,
        tableData,
        monitorsByGroup,
        groupTree,
        groupPaths,
        countSubtreeMonitors,
        toggleGroup,
        ungroupedMonitors,
        allMonitorIds,
        monitorScope,
        selectedIds,
        selectedCount,
        allSelected,
        someSelected,
        toggleMonitorSelection,
        toggleSelectAll,
        clearSelection,
        renderMonitorRow,
        renderGroupNode,
        clearFilters,
        activeFilterCount,
    };
}

type MonitorsTableModel = ReturnType<typeof useMonitorsTableModel>;

function MonitorsTableFiltersSection5({
    model,
}: {
    model: MonitorsTableModel;
}) {
    const {
        searchOpen,
        setSearchOpen,
        groupsOpen,
        setGroupsOpen,
        tagsOpen,
        setTagsOpen,
        filters,
        setFilters,
        search,
        activeFilter,
        typeFilter,
        statusFilter,
        groupFilter,
        tagFilter,
        expandedGroups,
        setExpandedGroups,
        selectedMonitorIds,
        setSelectedMonitorIds,
        previousMonitorScope,
        setPreviousMonitorScope,
        assignWorkerOpen,
        setAssignWorkerOpen,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        data,
        isLoading,
        groups,
        tags,
        monitorIds,
        sparklineData,
        monitors,
        total,
        isCapped,
        tableData,
        monitorsByGroup,
        groupTree,
        groupPaths,
        countSubtreeMonitors,
        toggleGroup,
        ungroupedMonitors,
        allMonitorIds,
        monitorScope,
        selectedIds,
        selectedCount,
        allSelected,
        someSelected,
        toggleMonitorSelection,
        toggleSelectAll,
        clearSelection,
        renderMonitorRow,
        renderGroupNode,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <DropdownMenuItem
            onClick={() => {
                void setFilters({ status: "degraded" });
            }}
            className="flex justify-between"
        >
            Degraded
            {statusFilter === "degraded" && (
                <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
            )}
        </DropdownMenuItem>
    );
}

function MonitorsTableFiltersSection6({
    model,
}: {
    model: MonitorsTableModel;
}) {
    const {
        searchOpen,
        setSearchOpen,
        groupsOpen,
        setGroupsOpen,
        tagsOpen,
        setTagsOpen,
        filters,
        setFilters,
        search,
        activeFilter,
        typeFilter,
        statusFilter,
        groupFilter,
        tagFilter,
        expandedGroups,
        setExpandedGroups,
        selectedMonitorIds,
        setSelectedMonitorIds,
        previousMonitorScope,
        setPreviousMonitorScope,
        assignWorkerOpen,
        setAssignWorkerOpen,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        data,
        isLoading,
        groups,
        tags,
        monitorIds,
        sparklineData,
        monitors,
        total,
        isCapped,
        tableData,
        monitorsByGroup,
        groupTree,
        groupPaths,
        countSubtreeMonitors,
        toggleGroup,
        ungroupedMonitors,
        allMonitorIds,
        monitorScope,
        selectedIds,
        selectedCount,
        allSelected,
        someSelected,
        toggleMonitorSelection,
        toggleSelectAll,
        clearSelection,
        renderMonitorRow,
        renderGroupNode,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <DropdownMenuItem
            onClick={() => {
                void setFilters({ status: "maintenance" });
            }}
            className="flex justify-between"
        >
            Maintenance
            {statusFilter === "maintenance" && (
                <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
            )}
        </DropdownMenuItem>
    );
}

function MonitorsTableFiltersSection7({
    model,
}: {
    model: MonitorsTableModel;
}) {
    const {
        searchOpen,
        setSearchOpen,
        groupsOpen,
        setGroupsOpen,
        tagsOpen,
        setTagsOpen,
        filters,
        setFilters,
        search,
        activeFilter,
        typeFilter,
        statusFilter,
        groupFilter,
        tagFilter,
        expandedGroups,
        setExpandedGroups,
        selectedMonitorIds,
        setSelectedMonitorIds,
        previousMonitorScope,
        setPreviousMonitorScope,
        assignWorkerOpen,
        setAssignWorkerOpen,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        data,
        isLoading,
        groups,
        tags,
        monitorIds,
        sparklineData,
        monitors,
        total,
        isCapped,
        tableData,
        monitorsByGroup,
        groupTree,
        groupPaths,
        countSubtreeMonitors,
        toggleGroup,
        ungroupedMonitors,
        allMonitorIds,
        monitorScope,
        selectedIds,
        selectedCount,
        allSelected,
        someSelected,
        toggleMonitorSelection,
        toggleSelectAll,
        clearSelection,
        renderMonitorRow,
        renderGroupNode,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <DropdownMenuItem
            onClick={() => {
                void setFilters({ type: "keyword" });
            }}
            className="flex justify-between"
        >
            Keyword
            {typeFilter === "keyword" && (
                <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
            )}
        </DropdownMenuItem>
    );
}

function MonitorsTableContentSection8({
    model,
}: {
    model: MonitorsTableModel;
}) {
    const {
        searchOpen,
        setSearchOpen,
        groupsOpen,
        setGroupsOpen,
        tagsOpen,
        setTagsOpen,
        filters,
        setFilters,
        search,
        activeFilter,
        typeFilter,
        statusFilter,
        groupFilter,
        tagFilter,
        expandedGroups,
        setExpandedGroups,
        selectedMonitorIds,
        setSelectedMonitorIds,
        previousMonitorScope,
        setPreviousMonitorScope,
        assignWorkerOpen,
        setAssignWorkerOpen,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        data,
        isLoading,
        groups,
        tags,
        monitorIds,
        sparklineData,
        monitors,
        total,
        isCapped,
        tableData,
        monitorsByGroup,
        groupTree,
        groupPaths,
        countSubtreeMonitors,
        toggleGroup,
        ungroupedMonitors,
        allMonitorIds,
        monitorScope,
        selectedIds,
        selectedCount,
        allSelected,
        someSelected,
        toggleMonitorSelection,
        toggleSelectAll,
        clearSelection,
        renderMonitorRow,
        renderGroupNode,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <div className="mb-2 flex items-center justify-between px-2 font-semibold text-muted-foreground text-xs uppercase">
            Group
            <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setGroupsOpen(true);
                }}
            >
                <FontAwesomeIcon icon={faPlus} className="h-3 w-3" />
            </Button>
        </div>
    );
}

function MonitorsTableFiltersSection9({
    model,
}: {
    model: MonitorsTableModel;
}) {
    const {
        searchOpen,
        setSearchOpen,
        groupsOpen,
        setGroupsOpen,
        tagsOpen,
        setTagsOpen,
        filters,
        setFilters,
        search,
        activeFilter,
        typeFilter,
        statusFilter,
        groupFilter,
        tagFilter,
        expandedGroups,
        setExpandedGroups,
        selectedMonitorIds,
        setSelectedMonitorIds,
        previousMonitorScope,
        setPreviousMonitorScope,
        assignWorkerOpen,
        setAssignWorkerOpen,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        data,
        isLoading,
        groups,
        tags,
        monitorIds,
        sparklineData,
        monitors,
        total,
        isCapped,
        tableData,
        monitorsByGroup,
        groupTree,
        groupPaths,
        countSubtreeMonitors,
        toggleGroup,
        ungroupedMonitors,
        allMonitorIds,
        monitorScope,
        selectedIds,
        selectedCount,
        allSelected,
        someSelected,
        toggleMonitorSelection,
        toggleSelectAll,
        clearSelection,
        renderMonitorRow,
        renderGroupNode,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <>
            {groupPaths.map(({ group, path, depth }) => (
                <DropdownMenuItem
                    key={group.id}
                    onClick={() => {
                        void setFilters({ groupId: group.id });
                    }}
                    className="flex justify-between"
                >
                    <div
                        className="flex items-center gap-2"
                        style={{ paddingLeft: depth * 12 }}
                    >
                        <FontAwesomeIcon
                            icon={faFolder}
                            className="h-3 w-3 text-muted-foreground"
                        />
                        {path}
                    </div>
                    {groupFilter === group.id && (
                        <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                    )}
                </DropdownMenuItem>
            ))}
        </>
    );
}

function MonitorsTableContentSection10({
    model,
}: {
    model: MonitorsTableModel;
}) {
    const {
        searchOpen,
        setSearchOpen,
        groupsOpen,
        setGroupsOpen,
        tagsOpen,
        setTagsOpen,
        filters,
        setFilters,
        search,
        activeFilter,
        typeFilter,
        statusFilter,
        groupFilter,
        tagFilter,
        expandedGroups,
        setExpandedGroups,
        selectedMonitorIds,
        setSelectedMonitorIds,
        previousMonitorScope,
        setPreviousMonitorScope,
        assignWorkerOpen,
        setAssignWorkerOpen,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        data,
        isLoading,
        groups,
        tags,
        monitorIds,
        sparklineData,
        monitors,
        total,
        isCapped,
        tableData,
        monitorsByGroup,
        groupTree,
        groupPaths,
        countSubtreeMonitors,
        toggleGroup,
        ungroupedMonitors,
        allMonitorIds,
        monitorScope,
        selectedIds,
        selectedCount,
        allSelected,
        someSelected,
        toggleMonitorSelection,
        toggleSelectAll,
        clearSelection,
        renderMonitorRow,
        renderGroupNode,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <div className="mb-2 flex items-center justify-between px-2 font-semibold text-muted-foreground text-xs uppercase">
            Tag
            <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTagsOpen(true);
                }}
            >
                <FontAwesomeIcon icon={faPlus} className="h-3 w-3" />
            </Button>
        </div>
    );
}

function MonitorsTableFiltersSection11({
    model,
}: {
    model: MonitorsTableModel;
}) {
    const {
        searchOpen,
        setSearchOpen,
        groupsOpen,
        setGroupsOpen,
        tagsOpen,
        setTagsOpen,
        filters,
        setFilters,
        search,
        activeFilter,
        typeFilter,
        statusFilter,
        groupFilter,
        tagFilter,
        expandedGroups,
        setExpandedGroups,
        selectedMonitorIds,
        setSelectedMonitorIds,
        previousMonitorScope,
        setPreviousMonitorScope,
        assignWorkerOpen,
        setAssignWorkerOpen,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        data,
        isLoading,
        groups,
        tags,
        monitorIds,
        sparklineData,
        monitors,
        total,
        isCapped,
        tableData,
        monitorsByGroup,
        groupTree,
        groupPaths,
        countSubtreeMonitors,
        toggleGroup,
        ungroupedMonitors,
        allMonitorIds,
        monitorScope,
        selectedIds,
        selectedCount,
        allSelected,
        someSelected,
        toggleMonitorSelection,
        toggleSelectAll,
        clearSelection,
        renderMonitorRow,
        renderGroupNode,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <>
            {tags?.map((tag) => (
                <DropdownMenuItem
                    key={tag.id}
                    onClick={() => {
                        void setFilters({ tagId: tag.id });
                    }}
                    className="flex justify-between"
                >
                    <div className="flex items-center gap-2">
                        <div
                            className="h-3 w-3 rounded-full"
                            style={{
                                backgroundColor: tag.color,
                            }}
                        />
                        {tag.name}
                    </div>
                    {tagFilter === tag.id && (
                        <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                    )}
                </DropdownMenuItem>
            ))}
        </>
    );
}

function MonitorsTableFiltersSection12({
    model,
}: {
    model: MonitorsTableModel;
}) {
    const {
        searchOpen,
        setSearchOpen,
        groupsOpen,
        setGroupsOpen,
        tagsOpen,
        setTagsOpen,
        filters,
        setFilters,
        search,
        activeFilter,
        typeFilter,
        statusFilter,
        groupFilter,
        tagFilter,
        expandedGroups,
        setExpandedGroups,
        selectedMonitorIds,
        setSelectedMonitorIds,
        previousMonitorScope,
        setPreviousMonitorScope,
        assignWorkerOpen,
        setAssignWorkerOpen,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        data,
        isLoading,
        groups,
        tags,
        monitorIds,
        sparklineData,
        monitors,
        total,
        isCapped,
        tableData,
        monitorsByGroup,
        groupTree,
        groupPaths,
        countSubtreeMonitors,
        toggleGroup,
        ungroupedMonitors,
        allMonitorIds,
        monitorScope,
        selectedIds,
        selectedCount,
        allSelected,
        someSelected,
        toggleMonitorSelection,
        toggleSelectAll,
        clearSelection,
        renderMonitorRow,
        renderGroupNode,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <>
            {(activeFilter !== null ||
                typeFilter !== null ||
                statusFilter !== null ||
                groupFilter !== null ||
                tagFilter !== null) && (
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
        </>
    );
}

function MonitorsTableFiltersSection4({
    model,
}: {
    model: MonitorsTableModel;
}) {
    const {
        searchOpen,
        setSearchOpen,
        groupsOpen,
        setGroupsOpen,
        tagsOpen,
        setTagsOpen,
        filters,
        setFilters,
        search,
        activeFilter,
        typeFilter,
        statusFilter,
        groupFilter,
        tagFilter,
        expandedGroups,
        setExpandedGroups,
        selectedMonitorIds,
        setSelectedMonitorIds,
        previousMonitorScope,
        setPreviousMonitorScope,
        assignWorkerOpen,
        setAssignWorkerOpen,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        data,
        isLoading,
        groups,
        tags,
        monitorIds,
        sparklineData,
        monitors,
        total,
        isCapped,
        tableData,
        monitorsByGroup,
        groupTree,
        groupPaths,
        countSubtreeMonitors,
        toggleGroup,
        ungroupedMonitors,
        allMonitorIds,
        monitorScope,
        selectedIds,
        selectedCount,
        allSelected,
        someSelected,
        toggleMonitorSelection,
        toggleSelectAll,
        clearSelection,
        renderMonitorRow,
        renderGroupNode,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <DropdownMenuContent align="end" className="w-56 p-2">
            <div className="mb-2 px-2 font-semibold text-muted-foreground text-xs uppercase">
                Status
            </div>
            <DropdownMenuItem
                onClick={() => {
                    void setFilters({ status: null });
                }}
                className="flex justify-between"
            >
                All Statuses
                {!statusFilter && (
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                )}
            </DropdownMenuItem>
            <DropdownMenuItem
                onClick={() => {
                    void setFilters({ status: "up" });
                }}
                className="flex justify-between"
            >
                Up
                {statusFilter === "up" && (
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                )}
            </DropdownMenuItem>
            <DropdownMenuItem
                onClick={() => {
                    void setFilters({ status: "down" });
                }}
                className="flex justify-between"
            >
                Down
                {statusFilter === "down" && (
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                )}
            </DropdownMenuItem>
            <MonitorsTableFiltersSection5 model={model} />
            <MonitorsTableFiltersSection6 model={model} />

            <div className="my-2 h-px bg-muted" />

            <div className="mb-2 px-2 font-semibold text-muted-foreground text-xs uppercase">
                Type
            </div>
            <DropdownMenuItem
                onClick={() => {
                    void setFilters({ type: null });
                }}
                className="flex justify-between"
            >
                All Types
                {!typeFilter && (
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                )}
            </DropdownMenuItem>
            <DropdownMenuItem
                onClick={() => {
                    void setFilters({ type: "http" });
                }}
                className="flex justify-between"
            >
                HTTP
                {typeFilter === "http" && (
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                )}
            </DropdownMenuItem>
            <DropdownMenuItem
                onClick={() => {
                    void setFilters({ type: "ping" });
                }}
                className="flex justify-between"
            >
                Ping
                {typeFilter === "ping" && (
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                )}
            </DropdownMenuItem>
            <DropdownMenuItem
                onClick={() => {
                    void setFilters({ type: "tcp" });
                }}
                className="flex justify-between"
            >
                TCP
                {typeFilter === "tcp" && (
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                )}
            </DropdownMenuItem>

            <DropdownMenuItem
                onClick={() => {
                    void setFilters({ type: "dns" });
                }}
                className="flex justify-between"
            >
                DNS
                {typeFilter === "dns" && (
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                )}
            </DropdownMenuItem>

            <MonitorsTableFiltersSection7 model={model} />

            <div className="my-2 h-px bg-muted" />

            <div className="mb-2 px-2 font-semibold text-muted-foreground text-xs uppercase">
                Active
            </div>
            <DropdownMenuItem
                onClick={() => {
                    void setFilters({ active: null });
                }}
                className="flex justify-between"
            >
                All
                {activeFilter === null && (
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                )}
            </DropdownMenuItem>
            <DropdownMenuItem
                onClick={() => {
                    void setFilters({ active: true });
                }}
                className="flex justify-between"
            >
                Active
                {activeFilter === true && (
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                )}
            </DropdownMenuItem>
            <DropdownMenuItem
                onClick={() => {
                    void setFilters({ active: false });
                }}
                className="flex justify-between"
            >
                Paused
                {activeFilter === false && (
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                )}
            </DropdownMenuItem>

            <div className="my-2 h-px bg-muted" />

            <MonitorsTableContentSection8 model={model} />
            <DropdownMenuItem
                onClick={() => {
                    void setFilters({ groupId: null });
                }}
                className="flex justify-between"
            >
                All Groups
                {!groupFilter && (
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                )}
            </DropdownMenuItem>
            <MonitorsTableFiltersSection9 model={model} />

            <div className="my-2 h-px bg-muted" />

            <MonitorsTableContentSection10 model={model} />
            <DropdownMenuItem
                onClick={() => {
                    void setFilters({ tagId: null });
                }}
                className="flex justify-between"
            >
                All Tags
                {!tagFilter && (
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                )}
            </DropdownMenuItem>
            <MonitorsTableFiltersSection11 model={model} />

            <MonitorsTableFiltersSection12 model={model} />
        </DropdownMenuContent>
    );
}

function MonitorsTableFiltersSection3({
    model,
}: {
    model: MonitorsTableModel;
}) {
    const {
        searchOpen,
        setSearchOpen,
        groupsOpen,
        setGroupsOpen,
        tagsOpen,
        setTagsOpen,
        filters,
        setFilters,
        search,
        activeFilter,
        typeFilter,
        statusFilter,
        groupFilter,
        tagFilter,
        expandedGroups,
        setExpandedGroups,
        selectedMonitorIds,
        setSelectedMonitorIds,
        previousMonitorScope,
        setPreviousMonitorScope,
        assignWorkerOpen,
        setAssignWorkerOpen,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        data,
        isLoading,
        groups,
        tags,
        monitorIds,
        sparklineData,
        monitors,
        total,
        isCapped,
        tableData,
        monitorsByGroup,
        groupTree,
        groupPaths,
        countSubtreeMonitors,
        toggleGroup,
        ungroupedMonitors,
        allMonitorIds,
        monitorScope,
        selectedIds,
        selectedCount,
        allSelected,
        someSelected,
        toggleMonitorSelection,
        toggleSelectAll,
        clearSelection,
        renderMonitorRow,
        renderGroupNode,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="outline"
                        size="icon"
                        className="relative"
                    />
                }
            >
                <FontAwesomeIcon icon={faFilter} className="h-4 w-4" />
                {activeFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground">
                        <div className="-mt-px">{activeFilterCount}</div>
                    </span>
                )}
            </DropdownMenuTrigger>
            <MonitorsTableFiltersSection4 model={model} />
        </DropdownMenu>
    );
}

function MonitorsTableContentSection2({
    model,
}: {
    model: MonitorsTableModel;
}) {
    const {
        searchOpen,
        setSearchOpen,
        groupsOpen,
        setGroupsOpen,
        tagsOpen,
        setTagsOpen,
        filters,
        setFilters,
        search,
        activeFilter,
        typeFilter,
        statusFilter,
        groupFilter,
        tagFilter,
        expandedGroups,
        setExpandedGroups,
        selectedMonitorIds,
        setSelectedMonitorIds,
        previousMonitorScope,
        setPreviousMonitorScope,
        assignWorkerOpen,
        setAssignWorkerOpen,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        data,
        isLoading,
        groups,
        tags,
        monitorIds,
        sparklineData,
        monitors,
        total,
        isCapped,
        tableData,
        monitorsByGroup,
        groupTree,
        groupPaths,
        countSubtreeMonitors,
        toggleGroup,
        ungroupedMonitors,
        allMonitorIds,
        monitorScope,
        selectedIds,
        selectedCount,
        allSelected,
        someSelected,
        toggleMonitorSelection,
        toggleSelectAll,
        clearSelection,
        renderMonitorRow,
        renderGroupNode,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <div className="flex items-center gap-2">
            <div className="relative hidden w-64 md:block">
                <FontAwesomeIcon
                    icon={faMagnifyingGlass}
                    className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground"
                />
                <Input
                    placeholder="Search monitors..."
                    className="pl-8"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                />
            </div>
            <Button
                variant="outline"
                size="icon"
                className="relative md:hidden"
                onClick={() => setSearchOpen(true)}
            >
                <FontAwesomeIcon icon={faMagnifyingGlass} className="h-4 w-4" />
                {search && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary" />
                )}
            </Button>
            <MonitorsTableFiltersSection3 model={model} />
            <Button
                className="w-9 gap-2 border-none bg-white p-0 text-black shadow-md shadow-white/10 hover:bg-gray-100 md:w-auto md:px-4"
                render={
                    <Link href="/monitors/new">
                        <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
                        <span className="hidden md:inline">Create monitor</span>
                    </Link>
                }
            />
        </div>
    );
}

function MonitorsTableContentSection1({
    model,
}: {
    model: MonitorsTableModel;
}) {
    const {
        searchOpen,
        setSearchOpen,
        groupsOpen,
        setGroupsOpen,
        tagsOpen,
        setTagsOpen,
        filters,
        setFilters,
        search,
        activeFilter,
        typeFilter,
        statusFilter,
        groupFilter,
        tagFilter,
        expandedGroups,
        setExpandedGroups,
        selectedMonitorIds,
        setSelectedMonitorIds,
        previousMonitorScope,
        setPreviousMonitorScope,
        assignWorkerOpen,
        setAssignWorkerOpen,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        data,
        isLoading,
        groups,
        tags,
        monitorIds,
        sparklineData,
        monitors,
        total,
        isCapped,
        tableData,
        monitorsByGroup,
        groupTree,
        groupPaths,
        countSubtreeMonitors,
        toggleGroup,
        ungroupedMonitors,
        allMonitorIds,
        monitorScope,
        selectedIds,
        selectedCount,
        allSelected,
        someSelected,
        toggleMonitorSelection,
        toggleSelectAll,
        clearSelection,
        renderMonitorRow,
        renderGroupNode,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <div className="flex items-center justify-between gap-4">
            <h1 className="font-bold text-2xl tracking-tight">Monitors</h1>
            <MonitorsTableContentSection2 model={model} />
        </div>
    );
}

function MonitorsTableContentSection13({
    model,
}: {
    model: MonitorsTableModel;
}) {
    const {
        searchOpen,
        setSearchOpen,
        groupsOpen,
        setGroupsOpen,
        tagsOpen,
        setTagsOpen,
        filters,
        setFilters,
        search,
        activeFilter,
        typeFilter,
        statusFilter,
        groupFilter,
        tagFilter,
        expandedGroups,
        setExpandedGroups,
        selectedMonitorIds,
        setSelectedMonitorIds,
        previousMonitorScope,
        setPreviousMonitorScope,
        assignWorkerOpen,
        setAssignWorkerOpen,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        data,
        isLoading,
        groups,
        tags,
        monitorIds,
        sparklineData,
        monitors,
        total,
        isCapped,
        tableData,
        monitorsByGroup,
        groupTree,
        groupPaths,
        countSubtreeMonitors,
        toggleGroup,
        ungroupedMonitors,
        allMonitorIds,
        monitorScope,
        selectedIds,
        selectedCount,
        allSelected,
        someSelected,
        toggleMonitorSelection,
        toggleSelectAll,
        clearSelection,
        renderMonitorRow,
        renderGroupNode,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex min-h-12 flex-col gap-3 border-b bg-muted/20 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3 font-medium text-muted-foreground text-sm">
                    {allMonitorIds.length > 0 ? (
                        <Checkbox
                            aria-label={
                                allSelected
                                    ? "Deselect all monitors"
                                    : "Select all monitors"
                            }
                            checked={allSelected}
                            indeterminate={someSelected && !allSelected}
                            onCheckedChange={(checked) =>
                                toggleSelectAll(checked === true)
                            }
                        />
                    ) : (
                        <FontAwesomeIcon
                            icon={faChevronDown}
                            className="h-4 w-4"
                        />
                    )}
                    <span>Monitors</span>
                </div>
                {selectedCount > 0 && (
                    <div className="flex min-h-7 flex-wrap items-center gap-2 lg:justify-end">
                        <span className="mr-1 whitespace-nowrap font-medium text-foreground text-sm">
                            {selectedCount} selected
                        </span>
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                render={<Button variant="outline" size="xs" />}
                            >
                                Actions
                                <FontAwesomeIcon
                                    icon={faChevronDown}
                                    className="h-4 w-4"
                                />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    onSelect={() => setAssignWorkerOpen(true)}
                                >
                                    <FontAwesomeIcon
                                        icon={faServer}
                                        className="h-4 w-4"
                                    />
                                    Assign worker
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Clear selection"
                            onClick={clearSelection}
                        >
                            <FontAwesomeIcon
                                icon={faXmark}
                                className="h-4 w-4"
                            />
                        </Button>
                    </div>
                )}
            </div>
            {isCapped && (
                <div className="border-b bg-amber-50 px-4 py-2 text-amber-900 text-sm dark:bg-amber-950/30 dark:text-amber-200">
                    Showing the first {MONITOR_LIST_LIMIT} of {total} monitors.
                    Use the filters to narrow the list and see the rest.
                </div>
            )}
            <Table>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                                <FontAwesomeIcon
                                    icon={faSpinner}
                                    className="mx-auto h-6 w-6 animate-spin text-muted-foreground"
                                />
                            </TableCell>
                        </TableRow>
                    ) : !tableData || tableData.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                                <div className="flex flex-col items-center justify-center gap-2 py-6">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                                        <FontAwesomeIcon
                                            icon={faCirclePlay}
                                            className="h-6 w-6 text-muted-foreground"
                                        />
                                    </div>
                                    <p className="font-medium text-lg">
                                        No monitors found
                                    </p>
                                    <p className="text-muted-foreground text-sm">
                                        {search ||
                                        activeFilter !== null ||
                                        typeFilter ||
                                        statusFilter ||
                                        groupFilter ||
                                        tagFilter
                                            ? "Try adjusting your filters"
                                            : "Get started by creating your first monitor."}
                                    </p>
                                    {!search &&
                                        activeFilter === null &&
                                        !typeFilter &&
                                        !statusFilter &&
                                        !groupFilter &&
                                        !tagFilter && (
                                            <div className="mt-2">
                                                <Button
                                                    render={
                                                        <Link href="/monitors/new" />
                                                    }
                                                >
                                                    Create monitor
                                                </Button>
                                            </div>
                                        )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : (
                        <>
                            {groupTree.flatMap((node) => renderGroupNode(node))}
                            {ungroupedMonitors.length > 0 && (
                                <Fragment key="ungrouped">
                                    <TableRow
                                        className="cursor-pointer border-b bg-muted/10 hover:bg-muted/20"
                                        onClick={() => toggleGroup("ungrouped")}
                                    >
                                        <TableCell colSpan={6} className="py-3">
                                            <div className="flex select-none items-center gap-2 font-medium text-sm">
                                                <FontAwesomeIcon
                                                    icon={faChevronRight}
                                                    className={cn(
                                                        "h-4 w-4 transition-transform",
                                                        (expandedGroups.ungrouped ??
                                                            true) &&
                                                            "rotate-90",
                                                    )}
                                                />
                                                <FontAwesomeIcon
                                                    icon={faFolder}
                                                    className="h-4 w-4 text-muted-foreground"
                                                />
                                                <span>Ungrouped</span>
                                                <span className="text-muted-foreground text-xs">
                                                    ({ungroupedMonitors.length})
                                                </span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    {(expandedGroups.ungrouped ?? true) &&
                                        ungroupedMonitors.map((monitor) =>
                                            renderMonitorRow(monitor, 1),
                                        )}
                                </Fragment>
                            )}
                        </>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
function MonitorsTableView({ model }: { model: MonitorsTableModel }) {
    const {
        searchOpen,
        setSearchOpen,
        groupsOpen,
        setGroupsOpen,
        tagsOpen,
        setTagsOpen,
        filters,
        setFilters,
        search,
        activeFilter,
        typeFilter,
        statusFilter,
        groupFilter,
        tagFilter,
        expandedGroups,
        setExpandedGroups,
        selectedMonitorIds,
        setSelectedMonitorIds,
        previousMonitorScope,
        setPreviousMonitorScope,
        assignWorkerOpen,
        setAssignWorkerOpen,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        data,
        isLoading,
        groups,
        tags,
        monitorIds,
        sparklineData,
        monitors,
        total,
        isCapped,
        tableData,
        monitorsByGroup,
        groupTree,
        groupPaths,
        countSubtreeMonitors,
        toggleGroup,
        ungroupedMonitors,
        allMonitorIds,
        monitorScope,
        selectedIds,
        selectedCount,
        allSelected,
        someSelected,
        toggleMonitorSelection,
        toggleSelectAll,
        clearSelection,
        renderMonitorRow,
        renderGroupNode,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <div className="mx-auto w-full max-w-6xl space-y-4">
            <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
                <DialogContent className="flex items-center justify-center border-none bg-transparent p-0 shadow-none sm:max-w-[425px]">
                    <DialogTitle className="sr-only">Search</DialogTitle>
                    <div className="relative w-full">
                        <Input
                            autoFocus
                            placeholder="Search monitors..."
                            className="h-12 rounded-full border-muted bg-background pr-12 pl-6 shadow-lg"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    setSearchOpen(false);
                                }
                            }}
                        />
                        <Button
                            size="icon"
                            className="absolute top-1 right-1 h-10 w-10 rounded-full"
                            onClick={() => setSearchOpen(false)}
                        >
                            <FontAwesomeIcon
                                icon={faArrowRight}
                                className="h-4 w-4"
                            />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            <MonitorsTableContentSection1 model={model} />

            <MonitorsTableContentSection13 model={model} />

            <GroupCreationDialog
                key={groupsOpen ? "group-dialog-open" : "group-dialog-closed"}
                open={groupsOpen}
                onOpenChange={setGroupsOpen}
            />
            <TagCreationDialog open={tagsOpen} onOpenChange={setTagsOpen} />
            <BulkAssignWorkerDialog
                key={
                    assignWorkerOpen
                        ? "assign-workers-open"
                        : "assign-workers-closed"
                }
                open={assignWorkerOpen}
                onOpenChange={setAssignWorkerOpen}
                monitorIds={selectedIds}
                onSuccess={clearSelection}
            />
        </div>
    );
}

export function MonitorsTable() {
    const model = useMonitorsTableModel();
    return <MonitorsTableView model={model} />;
}

type AssignWorkerMode = "add" | "replace";

function BulkAssignWorkerDialog({
    open,
    onOpenChange,
    monitorIds,
    onSuccess,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    monitorIds: string[];
    onSuccess: () => void;
}) {
    const queryClient = useQueryClient();
    const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<string>>(
        () => new Set(),
    );
    const [mode, setMode] = useState<AssignWorkerMode>("add");

    const { data: workers, isLoading: workersLoading } = useQuery({
        ...orpc.workers.listActive.queryOptions(),
        enabled: open,
    });

    const { mutate: assignWorkers, isPending } = useMutation({
        mutationFn: (input: {
            monitorIds: string[];
            workerIds: string[];
            mode: AssignWorkerMode;
        }) => client.monitors.bulkAssignWorkers(input),
        onSuccess: (result) => {
            sileo.success({
                title: `Workers assigned to ${result.updatedCount} monitor${
                    result.updatedCount === 1 ? "" : "s"
                }`,
            });
            queryClient.invalidateQueries({
                queryKey: orpc.monitors.list.key(),
            });
            onOpenChange(false);
            onSuccess();
        },
        onError: (error) =>
            sileo.error({
                title: `Failed to assign workers: ${error.message}`,
            }),
    });

    const monitorCount = monitorIds.length;
    const workerList = workers ?? [];
    const allWorkersSelected =
        workerList.length > 0 &&
        workerList.every((activeWorker) =>
            selectedWorkerIds.has(activeWorker.id),
        );

    const toggleWorker = (id: string, checked: boolean) => {
        setSelectedWorkerIds((previous) => {
            const next = new Set(previous);
            if (checked) {
                next.add(id);
            } else {
                next.delete(id);
            }
            return next;
        });
    };

    const toggleAllWorkers = () => {
        setSelectedWorkerIds(
            allWorkersSelected
                ? new Set()
                : new Set(workerList.map((activeWorker) => activeWorker.id)),
        );
    };

    const handleSubmit = () => {
        if (selectedWorkerIds.size === 0) {
            return;
        }
        assignWorkers({
            monitorIds,
            workerIds: Array.from(selectedWorkerIds),
            mode,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={!isPending}>
                <DialogHeader>
                    <DialogTitle>Assign workers to monitors</DialogTitle>
                    <DialogDescription>
                        Apply workers to{" "}
                        <span className="font-medium text-foreground">
                            {monitorCount} selected monitor
                            {monitorCount === 1 ? "" : "s"}
                        </span>
                        . If any monitor would exceed its per-monitor worker
                        limit, nothing is changed.
                    </DialogDescription>
                </DialogHeader>

                <DialogPanel className="space-y-4">
                    <div
                        className="space-y-2"
                        role="group"
                        aria-label="Workers"
                    >
                        <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">Workers</span>
                            <Button
                                type="button"
                                variant="link"
                                className="h-auto p-0 text-xs"
                                onClick={toggleAllWorkers}
                                disabled={isPending || workerList.length === 0}
                            >
                                {allWorkersSelected
                                    ? "Deselect all"
                                    : "Select all"}
                            </Button>
                        </div>
                        <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-1">
                            {workersLoading ? (
                                <p className="px-2 py-3 text-muted-foreground text-sm">
                                    Loading workers...
                                </p>
                            ) : workerList.length === 0 ? (
                                <p className="px-2 py-3 text-muted-foreground text-sm">
                                    No active workers available.
                                </p>
                            ) : (
                                workerList.map((activeWorker) => {
                                    const regionInfo = getRegionInfo(
                                        activeWorker.location,
                                    );
                                    const Flag = regionInfo.Flag;
                                    const checkboxId = `bulk-worker-${activeWorker.id}`;
                                    return (
                                        <div
                                            key={activeWorker.id}
                                            className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40"
                                        >
                                            <Checkbox
                                                id={checkboxId}
                                                checked={selectedWorkerIds.has(
                                                    activeWorker.id,
                                                )}
                                                disabled={isPending}
                                                onCheckedChange={(checked) =>
                                                    toggleWorker(
                                                        activeWorker.id,
                                                        checked === true,
                                                    )
                                                }
                                            />
                                            <Label
                                                htmlFor={checkboxId}
                                                className="flex flex-1 cursor-pointer items-center gap-2 font-normal"
                                            >
                                                <span className="relative size-5 shrink-0 overflow-hidden shadow-sm">
                                                    {isFontAwesomeRegionFlag(
                                                        Flag,
                                                    ) ? (
                                                        <FontAwesomeIcon
                                                            icon={Flag}
                                                            className="h-full w-full"
                                                        />
                                                    ) : (
                                                        <Flag className="h-full w-full" />
                                                    )}
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block truncate">
                                                        {activeWorker.name}
                                                    </span>
                                                    <span className="block truncate text-muted-foreground text-xs">
                                                        {regionInfo.label}
                                                    </span>
                                                </span>
                                            </Label>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <p className="text-muted-foreground text-xs">
                            {selectedWorkerIds.size} selected
                        </p>
                    </div>

                    <div
                        className="space-y-2"
                        role="group"
                        aria-label="Assignment mode"
                    >
                        <span className="font-medium text-sm">Mode</span>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                disabled={isPending}
                                onClick={() => setMode("add")}
                                className={cn(
                                    "rounded-lg border p-3 text-left text-sm transition-colors",
                                    mode === "add"
                                        ? "border-primary bg-primary/5"
                                        : "border-input hover:bg-muted/40",
                                )}
                            >
                                <span className="font-medium">Add</span>
                                <p className="mt-0.5 text-muted-foreground text-xs">
                                    Keep existing workers and add the selected
                                    ones.
                                </p>
                            </button>
                            <button
                                type="button"
                                disabled={isPending}
                                onClick={() => setMode("replace")}
                                className={cn(
                                    "rounded-lg border p-3 text-left text-sm transition-colors",
                                    mode === "replace"
                                        ? "border-primary bg-primary/5"
                                        : "border-input hover:bg-muted/40",
                                )}
                            >
                                <span className="font-medium">Replace</span>
                                <p className="mt-0.5 text-muted-foreground text-xs">
                                    Replace all workers with the selected ones.
                                </p>
                            </button>
                        </div>
                        {mode === "replace" && (
                            <p className="text-amber-600 text-xs dark:text-amber-500">
                                This removes any other workers currently
                                assigned.
                            </p>
                        )}
                    </div>
                </DialogPanel>

                <DialogFooter>
                    <DialogClose
                        render={<Button variant="ghost" disabled={isPending} />}
                    >
                        Cancel
                    </DialogClose>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        loading={isPending}
                        disabled={
                            selectedWorkerIds.size === 0 || monitorCount === 0
                        }
                    >
                        Assign to {monitorCount} monitor
                        {monitorCount === 1 ? "" : "s"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function MonitorActions({ monitor }: { monitor: Monitor }) {
    const queryClient = useQueryClient();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [nukeDialogOpen, setNukeDialogOpen] = useState(false);

    const { mutate: deleteMonitor } = useMutation({
        mutationFn: (id: string) => client.monitors.delete({ id }),
        onSuccess: () => {
            setDeleteDialogOpen(false);
            sileo.success({ title: "Monitor deleted" });
            queryClient.invalidateQueries({
                queryKey: orpc.monitors.list.key(),
            });
        },
        onError: () => sileo.error({ title: "Failed to delete monitor" }),
    });

    const { mutate: toggleMonitor } = useMutation({
        mutationFn: ({ id, active }: { id: string; active: boolean }) =>
            client.monitors.toggle({ id, active }),
        onSuccess: () => {
            sileo.success({ title: "Monitor updated" });
            queryClient.invalidateQueries({
                queryKey: orpc.monitors.list.key(),
            });
        },
        onError: () => sileo.error({ title: "Failed to update monitor" }),
    });

    const { mutate: nukeMonitor, isPending: isNuking } = useMutation({
        mutationFn: (monitorId: string) => client.monitors.nuke({ monitorId }),
        onSuccess: () => {
            setNukeDialogOpen(false);
            sileo.success({ title: "Monitor data nuked" });
            queryClient.invalidateQueries({
                queryKey: orpc.monitors.list.key(),
            });
            queryClient.invalidateQueries({
                queryKey: orpc.monitors.get.key({ input: { id: monitor.id } }),
            });
            queryClient.invalidateQueries({
                queryKey: orpc.monitors.getAvailability.key({
                    input: { monitorId: monitor.id },
                }),
            });
            queryClient.invalidateQueries({
                queryKey: orpc.monitors.getResponseTimes.key(),
            });
            queryClient.invalidateQueries({
                queryKey: orpc.incidents.list.key(),
            });
            queryClient.invalidateQueries({
                queryKey: orpc.monitors.getBatchLatencySparkline.key(),
            });
        },
        onError: () => sileo.error({ title: "Failed to nuke monitor data" }),
    });

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                        />
                    }
                >
                    <FontAwesomeIcon icon={faEllipsis} className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="end"
                    onClick={(e) => e.stopPropagation()}
                >
                    <DropdownMenuGroup>
                        <DropdownMenuGroupLabel>
                            {monitor.name}
                        </DropdownMenuGroupLabel>
                        <DropdownMenuItem
                            render={<Link href={`/monitors/${monitor.id}`} />}
                        >
                            <FontAwesomeIcon icon={faEye} />
                            View details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            render={
                                <Link href={`/monitors/${monitor.id}/edit`} />
                            }
                        >
                            <FontAwesomeIcon icon={faEdit} />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleMonitor({
                                    id: monitor.id,
                                    active: !monitor.active,
                                });
                            }}
                        >
                            <FontAwesomeIcon
                                icon={monitor.active ? faPause : faPlay}
                            />
                            {monitor.active
                                ? "Pause monitoring"
                                : monitor.pauseReason
                                  ? "Resume monitoring (re-check limits)"
                                  : "Resume monitoring"}
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        variant="destructive"
                        onClick={(e) => {
                            e.stopPropagation();
                            setNukeDialogOpen(true);
                        }}
                    >
                        <FontAwesomeIcon icon={faBomb} />
                        Nuke data
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        variant="destructive"
                        onClick={(e) => {
                            e.stopPropagation();
                            setDeleteDialogOpen(true);
                        }}
                    >
                        <FontAwesomeIcon icon={faTrash} />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={nukeDialogOpen} onOpenChange={setNukeDialogOpen}>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Nuke monitor data?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove historical check data and every
                            incident linked to this monitor. The monitor itself
                            will stay in place.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isNuking}>
                            Cancel
                        </AlertDialogCancel>
                        <Button
                            type="button"
                            variant="destructive"
                            loading={isNuking}
                            onClick={(e) => {
                                e.stopPropagation();
                                nukeMonitor(monitor.id);
                            }}
                        >
                            Nuke data
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            >
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently
                            delete the monitor and all of its data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={(e) => {
                                e.stopPropagation();
                                deleteMonitor(monitor.id);
                            }}
                        >
                            Delete
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
