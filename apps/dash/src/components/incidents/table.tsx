"use client";

import {
    faArrowRight,
    faCheck,
    faChevronDown,
    faChevronLeft,
    faChevronRight,
    faCircleCheck,
    faCircleQuestion,
    faClock,
    faEllipsis,
    faExclamation,
    faEye,
    faFilter,
    faHandshake,
    faMagnifyingGlass,
    faNetworkWired,
    faPlus,
    faShieldHalved,
    faSpinner,
    faTrash,
    faWrench,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    parseAsInteger,
    parseAsString,
    parseAsStringEnum,
    useQueryStates,
} from "nuqs";
import { useEffect, useRef, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { client, orpc } from "@/utils/orpc";

const PAGE_SIZE_OPTIONS = ["10", "25", "50", "100"] as const;
const INCIDENT_STATUS_FILTERS = ["open", "resolved"] as const;
const INCIDENT_SEVERITY_FILTERS = [
    "minor",
    "major",
    "critical",
    "maintenance",
] as const;
const INCIDENT_TYPE_FILTERS = ["manual", "automatic"] as const;

type BulkIncidentAction = "acknowledge" | "resolve" | "delete";

interface BulkIncidentActionFailure {
    id: string;
    message: string;
}

interface BulkIncidentActionResult {
    succeededIds: string[];
    failedIds: string[];
    failedIncidents: BulkIncidentActionFailure[];
}

function formatIncidentCount(count: number) {
    return `${count} incident${count === 1 ? "" : "s"}`;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function getBulkActionFailureMessage(
    failedIncidents: BulkIncidentActionFailure[],
) {
    return failedIncidents
        .map(({ id, message }) => `${id} (${message})`)
        .join(", ");
}

function getBulkActionResult(
    ids: string[],
    results: PromiseSettledResult<string>[],
): BulkIncidentActionResult {
    return results.reduce<BulkIncidentActionResult>(
        (result, settledResult, index) => {
            if (settledResult.status === "fulfilled") {
                result.succeededIds.push(settledResult.value);
                return result;
            }

            result.failedIds.push(ids[index]);
            result.failedIncidents.push({
                id: ids[index],
                message: getErrorMessage(settledResult.reason),
            });

            return result;
        },
        { succeededIds: [], failedIds: [], failedIncidents: [] },
    );
}

function getBulkActionSuccessTitle(action: BulkIncidentAction, count: number) {
    const incidentCount = formatIncidentCount(count);

    switch (action) {
        case "acknowledge":
            return `${incidentCount} acknowledged`;
        case "resolve":
            return `${incidentCount} resolved`;
        case "delete":
            return `${incidentCount} deleted`;
    }
}

function getBulkActionErrorTitle(action: BulkIncidentAction, message: string) {
    switch (action) {
        case "acknowledge":
            return `Failed to acknowledge incidents: ${message}`;
        case "resolve":
            return `Failed to resolve incidents: ${message}`;
        case "delete":
            return `Failed to delete incidents: ${message}`;
    }
}

function getStatusIcon(status: string) {
    switch (status) {
        case "scheduled":
            return (
                <FontAwesomeIcon
                    icon={faClock}
                    className="h-5 w-5 text-blue-500"
                />
            );
        case "resolved":
        case "completed":
            return (
                <FontAwesomeIcon
                    icon={faCircleCheck}
                    className="h-5 w-5 text-emerald-500"
                />
            );
        case "investigating":
        case "identified":
        case "monitoring":
        case "in_progress":
            return (
                <FontAwesomeIcon
                    icon={faShieldHalved}
                    className="h-5 w-5 text-red-500"
                />
            );
        default:
            return (
                <FontAwesomeIcon
                    icon={faCircleQuestion}
                    className="h-5 w-5 text-muted-foreground"
                />
            );
    }
}

function getStatusColor(status: string) {
    switch (status) {
        case "resolved":
        case "completed":
            return "border-emerald-500/20 bg-emerald-500/10 text-emerald-500";
        case "investigating":
        case "identified":
        case "monitoring":
        case "in_progress":
            return "border-red-500/20 bg-red-500/10 text-red-500";
        case "scheduled":
            return "border-blue-500/20 bg-blue-500/10 text-blue-500";
        default:
            return "border-muted bg-muted/50 text-muted-foreground";
    }
}

function getIncidentDisplayStatus(incident: {
    severity: string;
    status: string;
    startedAt: string | Date;
    plannedEndAt?: string | Date | null;
    endedAt?: string | Date | null;
}) {
    if (incident.severity !== "maintenance") return incident.status;

    const now = new Date();
    if (incident.endedAt) return "completed";
    if (incident.plannedEndAt && new Date(incident.plannedEndAt) <= now) {
        return "completed";
    }
    if (new Date(incident.startedAt) > now) return "scheduled";
    return "in_progress";
}

function useIncidentsTableModel() {
    const router = useRouter();
    const suppressRowNavigationRef = useRef(false);
    const suppressRowNavigationTimeoutRef = useRef<ReturnType<
        typeof setTimeout
    > | null>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [filters, setFilters] = useQueryStates({
        search: parseAsString.withDefault(""),
        status: parseAsStringEnum([...INCIDENT_STATUS_FILTERS]),
        severity: parseAsStringEnum([...INCIDENT_SEVERITY_FILTERS]),
        type: parseAsStringEnum([...INCIDENT_TYPE_FILTERS]),
        monitorId: parseAsString,
        statusPageId: parseAsString,
        page: parseAsInteger.withDefault(1),
        pageSize: parseAsStringEnum([...PAGE_SIZE_OPTIONS]).withDefault("25"),
    });
    const {
        search,
        status: statusFilter,
        severity: severityFilter,
        type: typeFilter,
        monitorId: monitorFilter,
        statusPageId: statusPageFilter,
        page: pageParam,
        pageSize: pageSizeParam,
    } = filters;
    const page = Math.max(pageParam, 1);
    const [selectedIncidentIds, setSelectedIncidentIds] = useState<Set<string>>(
        () => new Set(),
    );
    const [previousSelectionScope, setPreviousSelectionScope] = useState("");
    const [mergeOpen, setMergeOpen] = useState(false);
    const [mergePrimaryIncidentId, setMergePrimaryIncidentId] = useState<
        string | null
    >(null);
    const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
    const [incidentToDelete, setIncidentToDelete] = useState<{
        id: string;
        title: string;
    } | null>(null);
    const pageSize = Number(pageSizeParam);
    const [searchInput, setSearchInput] = useState(search);
    const [previousSearch, setPreviousSearch] = useState(search);
    const [debouncedSearch, setDebouncedSearch] = useState(search);
    if (search !== previousSearch) {
        setPreviousSearch(search);
        setSearchInput(search);
    }

    const suppressRowNavigation = () => {
        suppressRowNavigationRef.current = true;
        if (suppressRowNavigationTimeoutRef.current) {
            clearTimeout(suppressRowNavigationTimeoutRef.current);
        }
        suppressRowNavigationTimeoutRef.current = setTimeout(() => {
            suppressRowNavigationRef.current = false;
        }, 500);
    };

    const handleIncidentRowClick = (incidentId: string) => {
        if (suppressRowNavigationRef.current) {
            return;
        }

        router.push(`/incidents/${incidentId}`);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchInput);
            if (searchInput !== search) {
                void setFilters({
                    search: searchInput || null,
                    page: 1,
                });
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchInput, setFilters, search]);

    const { data, isLoading } = useQuery(
        orpc.incidents.list.queryOptions({
            input: {
                status: statusFilter ?? "all",
                limit: pageSize,
                offset: (page - 1) * pageSize,
                q: debouncedSearch || undefined,
                severity: severityFilter ?? undefined,
                type: typeFilter ?? undefined,
                monitorId: monitorFilter ?? undefined,
                statusPageId: statusPageFilter ?? undefined,
            },
        }),
    );
    const { data: monitorsData } = useQuery({
        ...orpc.monitors.list.queryOptions({ input: { limit: 100 } }),
        enabled: filtersOpen || monitorFilter !== null,
    });
    const { data: statusPagesData } = useQuery({
        ...orpc.statusPages.list.queryOptions({ input: { limit: 100 } }),
        enabled: filtersOpen || statusPageFilter !== null,
    });

    const incidents = data?.items;
    const monitors = monitorsData?.items ?? [];
    const statusPages = statusPagesData?.items ?? [];
    const total = data?.total || 0;
    const totalPages = Math.ceil(total / pageSize);
    const currentPageIncidentIds =
        incidents?.map((incident) => incident.id) ?? [];
    const selectionScope = [
        debouncedSearch,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        page,
        pageSize,
        currentPageIncidentIds.join(","),
    ].join(":");
    if (selectionScope !== previousSelectionScope) {
        setPreviousSelectionScope(selectionScope);
        setSelectedIncidentIds(new Set());
    }
    const selectedIds = Array.from(selectedIncidentIds);
    const selectedIncidents =
        incidents?.filter((incident) => selectedIncidentIds.has(incident.id)) ??
        [];
    const { selectedOpenIds, selectedUnacknowledgedOpenIds } =
        selectedIncidents.reduce(
            (result, incident) => {
                if (!incident.endedAt) {
                    result.selectedOpenIds.push(incident.id);
                    if (!incident.acknowledgedAt) {
                        result.selectedUnacknowledgedOpenIds.push(incident.id);
                    }
                }
                return result;
            },
            {
                selectedOpenIds: [] as string[],
                selectedUnacknowledgedOpenIds: [] as string[],
            },
        );
    const selectedCount = selectedIds.length;
    const visibleStart =
        total === 0 ? 0 : Math.min((page - 1) * pageSize + 1, total);
    const visibleEnd = total === 0 ? 0 : Math.min(page * pageSize, total);
    const allCurrentPageSelected =
        currentPageIncidentIds.length > 0 &&
        currentPageIncidentIds.every((id) => selectedIncidentIds.has(id));
    const someCurrentPageSelected =
        currentPageIncidentIds.length > 0 &&
        currentPageIncidentIds.some((id) => selectedIncidentIds.has(id));

    const queryClient = useQueryClient();

    const { mutate: deleteIncident, isPending: isDeleting } = useMutation({
        mutationFn: (id: string) => client.incidents.delete({ id }),
        onSuccess: (_data, id) => {
            sileo.success({ title: "Incident deleted" });
            queryClient.invalidateQueries({
                queryKey: orpc.incidents.list.key(),
            });
            setSelectedIncidentIds((previous) => {
                const next = new Set(previous);
                next.delete(id);
                return next;
            });
            setIncidentToDelete(null);
        },
        onError: (err) => {
            sileo.error({ title: `Failed to delete incident: ${err.message}` });
            setIncidentToDelete(null);
        },
    });

    const bulkIncidentAction = useMutation({
        mutationFn: async ({
            action,
            ids,
        }: {
            action: BulkIncidentAction;
            ids: string[];
        }) => {
            if (action === "acknowledge") {
                const results = await Promise.allSettled(
                    ids.map(async (id) => {
                        await client.incidents.acknowledge({ id });
                        return id;
                    }),
                );

                return getBulkActionResult(ids, results);
            }

            if (action === "resolve") {
                const results = await Promise.allSettled(
                    ids.map(async (id) => {
                        await client.incidents.resolve({ id });
                        return id;
                    }),
                );

                return getBulkActionResult(ids, results);
            }

            const results = await Promise.allSettled(
                ids.map(async (id) => {
                    await client.incidents.delete({ id });
                    return id;
                }),
            );

            return getBulkActionResult(ids, results);
        },
        onError: (err, { action, ids }) => {
            sileo.error({
                title: getBulkActionErrorTitle(
                    action,
                    getBulkActionFailureMessage(
                        ids.map((id) => ({
                            id,
                            message: getErrorMessage(err),
                        })),
                    ),
                ),
            });
        },
        onSettled: (data, _error, { action }) => {
            if (data) {
                const succeededIdSet = new Set(data.succeededIds);

                if (data.succeededIds.length > 0) {
                    sileo.success({
                        title: getBulkActionSuccessTitle(
                            action,
                            data.succeededIds.length,
                        ),
                    });
                    setSelectedIncidentIds((previous) => {
                        const next = new Set(previous);

                        for (const id of succeededIdSet) {
                            next.delete(id);
                        }

                        return next;
                    });
                    setBulkDeleteIds((previous) =>
                        previous.filter((id) => !succeededIdSet.has(id)),
                    );
                }

                if (data.failedIds.length > 0) {
                    sileo.error({
                        title: getBulkActionErrorTitle(
                            action,
                            getBulkActionFailureMessage(data.failedIncidents),
                        ),
                    });
                }
            }

            queryClient.invalidateQueries({
                queryKey: orpc.incidents.list.key(),
            });
        },
    });

    const mergeIncidents = useMutation({
        mutationFn: (input: {
            targetIncidentId: string;
            sourceIncidentIds: string[];
        }) => client.incidents.merge(input),
        onSuccess: (_data, input) => {
            sileo.success({
                title: `${formatIncidentCount(input.sourceIncidentIds.length)} merged`,
            });
            queryClient.invalidateQueries({
                queryKey: orpc.incidents.list.key(),
            });
            setSelectedIncidentIds(new Set());
            setMergePrimaryIncidentId(null);
            setMergeOpen(false);
        },
        onError: (err) => {
            sileo.error({ title: `Failed to merge incidents: ${err.message}` });
        },
    });

    useEffect(() => {
        if (totalPages > 0 && page > totalPages) {
            void setFilters({ page: totalPages });
        }
    }, [page, setFilters, totalPages]);

    const clearSelection = () => {
        setSelectedIncidentIds(new Set());
    };

    const toggleIncidentSelection = (id: string, checked: boolean) => {
        setSelectedIncidentIds((previous) => {
            const next = new Set(previous);

            if (checked) {
                next.add(id);
            } else {
                next.delete(id);
            }

            return next;
        });
    };

    const toggleCurrentPageSelection = (checked: boolean) => {
        setSelectedIncidentIds(
            checked ? new Set(currentPageIncidentIds) : new Set(),
        );
    };

    const runBulkAction = (action: BulkIncidentAction, ids: string[]) => {
        if (ids.length === 0) {
            return;
        }

        bulkIncidentAction.mutate({ action, ids });
    };

    const openMergeDialog = () => {
        if (selectedIncidents.length < 2) {
            return;
        }

        setMergePrimaryIncidentId(
            selectedIncidents.find((incident) => !incident.endedAt)?.id ??
                selectedIncidents[0].id,
        );
        setMergeOpen(true);
    };

    const runMergeAction = () => {
        if (!mergePrimaryIncidentId) {
            return;
        }

        const sourceIncidentIds = selectedIds.filter(
            (id) => id !== mergePrimaryIncidentId,
        );

        if (sourceIncidentIds.length === 0) {
            return;
        }

        mergeIncidents.mutate({
            targetIncidentId: mergePrimaryIncidentId,
            sourceIncidentIds,
        });
    };

    const clearFilters = () => {
        setSearchInput("");
        void setFilters({
            search: null,
            status: null,
            severity: null,
            type: null,
            monitorId: null,
            statusPageId: null,
            page: 1,
        });
        clearSelection();
    };

    const activeFilterCount = [
        statusFilter !== null,
        severityFilter !== null,
        typeFilter !== null,
        monitorFilter !== null,
        statusPageFilter !== null,
    ].filter(Boolean).length;

    return {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
        clearFilters,
        activeFilterCount,
    };
}

type IncidentsTableModel = ReturnType<typeof useIncidentsTableModel>;

function IncidentsTableDialog1({ model }: { model: IncidentsTableModel }) {
    const {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <Dialog
            open={mergeOpen}
            onOpenChange={(open) => {
                if (!mergeIncidents.isPending) {
                    setMergeOpen(open);
                }
            }}
        >
            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>Merge incidents</DialogTitle>
                    <DialogDescription>
                        Choose the incident that should remain. The other
                        selected incidents will be folded into it.
                    </DialogDescription>
                </DialogHeader>
                <DialogPanel className="space-y-3">
                    <RadioGroup
                        value={mergePrimaryIncidentId ?? ""}
                        onValueChange={setMergePrimaryIncidentId}
                    >
                        {selectedIncidents.map((incident) => (
                            <label
                                key={incident.id}
                                htmlFor={`merge-primary-${incident.id}`}
                                className={cn(
                                    "flex cursor-pointer items-start gap-3 rounded-lg border bg-popover p-3 transition-colors hover:bg-accent/50",
                                    mergePrimaryIncidentId === incident.id &&
                                        "border-primary bg-primary/5",
                                )}
                            >
                                <RadioGroupItem
                                    id={`merge-primary-${incident.id}`}
                                    value={incident.id}
                                    className="mt-1"
                                />
                                <div className="min-w-0 flex-1 space-y-1">
                                    <div className="truncate font-medium text-sm">
                                        {incident.title}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                                        <span>
                                            Started{" "}
                                            {formatDistanceToNow(
                                                new Date(incident.startedAt),
                                                {
                                                    addSuffix: true,
                                                },
                                            )}
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className="h-5 capitalize"
                                        >
                                            {incident.status}
                                        </Badge>
                                        <Badge
                                            variant="outline"
                                            className="h-5 capitalize"
                                        >
                                            {incident.severity}
                                        </Badge>
                                    </div>
                                </div>
                            </label>
                        ))}
                    </RadioGroup>
                </DialogPanel>
                <DialogFooter>
                    <Button
                        variant="ghost"
                        onClick={() => setMergeOpen(false)}
                        disabled={mergeIncidents.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={runMergeAction}
                        disabled={
                            !mergePrimaryIncidentId || mergeIncidents.isPending
                        }
                    >
                        {mergeIncidents.isPending ? (
                            <>
                                <FontAwesomeIcon
                                    icon={faSpinner}
                                    className="mr-2 h-4 w-4 animate-spin"
                                />
                                Merging...
                            </>
                        ) : (
                            "Merge incidents"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function IncidentsTableFiltersSection6({
    model,
}: {
    model: IncidentsTableModel;
}) {
    const {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <DropdownMenuItem
            onClick={() => {
                void setFilters({
                    severity: "maintenance",
                    page: 1,
                });
            }}
            className="flex justify-between"
        >
            Maintenance
            {severityFilter === "maintenance" && (
                <FontAwesomeIcon icon={faWrench} className="h-4 w-4" />
            )}
        </DropdownMenuItem>
    );
}

function IncidentsTableFiltersSection7({
    model,
}: {
    model: IncidentsTableModel;
}) {
    const {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <DropdownMenuItem
            onClick={() => {
                void setFilters({
                    severity: "critical",
                    page: 1,
                });
            }}
            className="flex justify-between"
        >
            Critical
            {severityFilter === "critical" && (
                <FontAwesomeIcon icon={faExclamation} className="h-4 w-4" />
            )}
        </DropdownMenuItem>
    );
}

function IncidentsTableFiltersSection8({
    model,
}: {
    model: IncidentsTableModel;
}) {
    const {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <>
            {monitors.map((monitor) => (
                <DropdownMenuItem
                    key={monitor.id}
                    onClick={() => {
                        void setFilters({
                            monitorId: monitor.id,
                            page: 1,
                        });
                    }}
                    className="flex justify-between gap-2"
                >
                    <span className="truncate">{monitor.name}</span>
                    {monitorFilter === monitor.id && (
                        <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                    )}
                </DropdownMenuItem>
            ))}
        </>
    );
}

function IncidentsTableFiltersSection9({
    model,
}: {
    model: IncidentsTableModel;
}) {
    const {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <DropdownMenuItem
            onClick={() => {
                void setFilters({
                    statusPageId: null,
                    page: 1,
                });
            }}
            className="flex justify-between"
        >
            All Status Pages
            {statusPageFilter === null && (
                <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
            )}
        </DropdownMenuItem>
    );
}

function IncidentsTableFiltersSection10({
    model,
}: {
    model: IncidentsTableModel;
}) {
    const {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <>
            {statusPages.map((statusPage) => (
                <DropdownMenuItem
                    key={statusPage.id}
                    onClick={() => {
                        void setFilters({
                            statusPageId: statusPage.id,
                            page: 1,
                        });
                    }}
                    className="flex justify-between gap-2"
                >
                    <span className="truncate">{statusPage.name}</span>
                    {statusPageFilter === statusPage.id && (
                        <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                    )}
                </DropdownMenuItem>
            ))}
        </>
    );
}

function IncidentsTableFiltersSection11({
    model,
}: {
    model: IncidentsTableModel;
}) {
    const {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <div className="px-2">
            <Select
                value={pageSizeParam}
                onValueChange={(value) => {
                    void setFilters({
                        pageSize: value as (typeof PAGE_SIZE_OPTIONS)[number],
                        page: 1,
                    });
                }}
            >
                <SelectTrigger
                    className="h-8 w-full"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <SelectValue placeholder="Page size">
                        {pageSize} per page
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={size}>
                            {size} per page
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function IncidentsTableFiltersSection5({
    model,
}: {
    model: IncidentsTableModel;
}) {
    const {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
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
                    void setFilters({ status: null, page: 1 });
                }}
                className="flex justify-between"
            >
                All Statuses
                {statusFilter === null && (
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                )}
            </DropdownMenuItem>
            <DropdownMenuItem
                onClick={() => {
                    void setFilters({
                        status: "open",
                        page: 1,
                    });
                }}
                className="flex justify-between"
            >
                Open
                {statusFilter === "open" && (
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                )}
            </DropdownMenuItem>
            <DropdownMenuItem
                onClick={() => {
                    void setFilters({
                        status: "resolved",
                        page: 1,
                    });
                }}
                className="flex justify-between"
            >
                Resolved
                {statusFilter === "resolved" && (
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                )}
            </DropdownMenuItem>
            <IncidentsTableFiltersSection6 model={model} />

            <div className="my-2 h-px bg-muted" />

            <div className="mb-2 px-2 font-semibold text-muted-foreground text-xs uppercase">
                Severity
            </div>
            <DropdownMenuItem
                onClick={() => {
                    void setFilters({
                        severity: null,
                        page: 1,
                    });
                }}
                className="flex justify-between"
            >
                All Severities
                {!severityFilter && (
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                )}
            </DropdownMenuItem>
            <DropdownMenuItem
                onClick={() => {
                    void setFilters({
                        severity: "minor",
                        page: 1,
                    });
                }}
                className="flex justify-between"
            >
                Minor
                {severityFilter === "minor" && (
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                )}
            </DropdownMenuItem>
            <DropdownMenuItem
                onClick={() => {
                    void setFilters({
                        severity: "major",
                        page: 1,
                    });
                }}
                className="flex justify-between"
            >
                Major
                {severityFilter === "major" && (
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                )}
            </DropdownMenuItem>
            <IncidentsTableFiltersSection7 model={model} />

            <div className="my-2 h-px bg-muted" />

            <div className="mb-2 px-2 font-semibold text-muted-foreground text-xs uppercase">
                Type
            </div>
            <DropdownMenuItem
                onClick={() => {
                    void setFilters({ type: null, page: 1 });
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
                    void setFilters({
                        type: "manual",
                        page: 1,
                    });
                }}
                className="flex justify-between"
            >
                Manual
                {typeFilter === "manual" && (
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                )}
            </DropdownMenuItem>
            <DropdownMenuItem
                onClick={() => {
                    void setFilters({
                        type: "automatic",
                        page: 1,
                    });
                }}
                className="flex justify-between"
            >
                Automatic
                {typeFilter === "automatic" && (
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                )}
            </DropdownMenuItem>

            <div className="my-2 h-px bg-muted" />

            <div className="mb-2 px-2 font-semibold text-muted-foreground text-xs uppercase">
                Affected Monitor
            </div>
            <DropdownMenuItem
                onClick={() => {
                    void setFilters({
                        monitorId: null,
                        page: 1,
                    });
                }}
                className="flex justify-between"
            >
                All Monitors
                {monitorFilter === null && (
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                )}
            </DropdownMenuItem>
            <IncidentsTableFiltersSection8 model={model} />

            <div className="my-2 h-px bg-muted" />

            <div className="mb-2 px-2 font-semibold text-muted-foreground text-xs uppercase">
                Status Page
            </div>
            <IncidentsTableFiltersSection9 model={model} />
            <IncidentsTableFiltersSection10 model={model} />

            <div className="my-2 h-px bg-muted" />

            <div className="mb-2 px-2 font-semibold text-muted-foreground text-xs uppercase">
                Page Size
            </div>
            {/** biome-ignore lint/a11y/noStaticElementInteractions: keep Select interactions inside the filter menu */}
            {/** biome-ignore lint/a11y/useKeyWithClickEvents: Select handles keyboard interaction */}
            <IncidentsTableFiltersSection11 model={model} />

            {activeFilterCount > 0 && (
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
        </DropdownMenuContent>
    );
}

function IncidentsTableFiltersSection4({
    model,
}: {
    model: IncidentsTableModel;
}) {
    const {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <DropdownMenu
            modal={false}
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
        >
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
                        {activeFilterCount}
                    </span>
                )}
            </DropdownMenuTrigger>
            <IncidentsTableFiltersSection5 model={model} />
        </DropdownMenu>
    );
}

function IncidentsTableContentSection3({
    model,
}: {
    model: IncidentsTableModel;
}) {
    const {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
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
                    placeholder="Search incidents..."
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
            <IncidentsTableFiltersSection4 model={model} />
            <Button
                className="w-9 gap-2 border-none bg-white p-0 text-black shadow-md shadow-white/10 hover:bg-gray-100 md:w-auto md:px-4"
                render={
                    <Link href="/incidents/new">
                        <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
                        <span className="hidden md:inline">
                            Report a new incident
                        </span>
                    </Link>
                }
            />
        </div>
    );
}

function IncidentsTableContentSection2({
    model,
}: {
    model: IncidentsTableModel;
}) {
    const {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <div className="flex items-center justify-between gap-4">
            <h1 className="font-bold text-2xl tracking-tight">Incidents</h1>
            <IncidentsTableContentSection3 model={model} />
        </div>
    );
}

function useIncidentsTableDataTable15Model({
    model,
}: {
    model: IncidentsTableModel;
}) {
    const {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
        clearFilters,
        activeFilterCount,
    } = model;
    return {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
        clearFilters,
        activeFilterCount,
    };
}

type IncidentsTableDataTable15Model = ReturnType<
    typeof useIncidentsTableDataTable15Model
>;

function IncidentsTableDataTable15DataTable2({
    model,
}: {
    model: IncidentsTableDataTable15Model;
}) {
    const {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <TableRow>
            <TableCell colSpan={5} className="h-24 text-center">
                <FontAwesomeIcon
                    icon={faSpinner}
                    className="mx-auto h-6 w-6 animate-spin text-muted-foreground"
                />
            </TableCell>
        </TableRow>
    );
}

function IncidentsTableDataTable15DataTable3({
    model,
}: {
    model: IncidentsTableDataTable15Model;
}) {
    const {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <TableRow>
            <TableCell colSpan={5} className="h-24 text-center">
                <div className="flex flex-col items-center justify-center gap-2 py-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                        <FontAwesomeIcon
                            icon={faShieldHalved}
                            className="h-6 w-6 text-muted-foreground"
                        />
                    </div>
                    <p className="font-medium text-lg">No incidents found</p>
                    <p className="text-muted-foreground text-sm">
                        {search ||
                        statusFilter !== null ||
                        severityFilter ||
                        typeFilter ||
                        monitorFilter ||
                        statusPageFilter
                            ? "Try adjusting your filters"
                            : "Get started by creating your first incident."}
                    </p>
                    {!search &&
                        statusFilter === null &&
                        !severityFilter &&
                        !typeFilter &&
                        !monitorFilter &&
                        !statusPageFilter && (
                            <div className="mt-2">
                                <Button
                                    render={
                                        <Link href="/incidents/new">
                                            Create incident
                                        </Link>
                                    }
                                />
                            </div>
                        )}
                </div>
            </TableCell>
        </TableRow>
    );
}

function IncidentTableRow({
    model,
    incident,
    isSelected,
    displayStatus,
}: {
    model: IncidentsTableDataTable15Model;
    incident: NonNullable<IncidentsTableModel["incidents"]>[number];
    isSelected: boolean;
    displayStatus: ReturnType<typeof getIncidentDisplayStatus>;
}) {
    const {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <TableRow
            key={incident.id}
            className="group h-[72px] cursor-pointer hover:bg-muted/40"
            data-state={isSelected ? "selected" : undefined}
            onClick={() => handleIncidentRowClick(incident.id)}
        >
            <TableCell
                className="w-12 pr-0 pl-4"
                onClick={(event) => event.stopPropagation()}
            >
                <Checkbox
                    aria-label={`Select ${incident.title}`}
                    checked={isSelected}
                    onCheckedChange={(checked) =>
                        toggleIncidentSelection(incident.id, checked === true)
                    }
                />
            </TableCell>
            <TableCell className="min-w-[280px] pl-2">
                <Link
                    href={`/incidents/${incident.id}`}
                    className="flex items-center gap-4"
                    onClick={(event) => event.stopPropagation()}
                >
                    <div
                        className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
                            getStatusColor(displayStatus),
                        )}
                    >
                        {getStatusIcon(displayStatus)}
                    </div>
                    <div className="grid gap-1">
                        <span className="font-semibold leading-none transition-colors group-hover:text-primary">
                            {incident.title}
                        </span>
                        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
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
                            {incident.statusPages.length > 0 && (
                                <Badge
                                    variant="secondary"
                                    className="h-5 px-1.5 text-[10px]"
                                >
                                    Public
                                </Badge>
                            )}
                            {incident.severity && (
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "h-5 border-none px-1.5 text-[10px] uppercase",
                                        incident.severity === "minor" &&
                                            "bg-blue-500/10 text-blue-500",
                                        incident.severity === "major" &&
                                            "bg-amber-500/10 text-amber-500",
                                        incident.severity === "critical" &&
                                            "bg-red-500/10 text-red-500",
                                        incident.severity === "maintenance" &&
                                            "bg-blue-500/10 text-blue-500",
                                    )}
                                >
                                    {incident.severity}
                                </Badge>
                            )}
                        </div>
                    </div>
                </Link>
            </TableCell>
            <TableCell className="font-medium text-muted-foreground text-sm">
                {formatDistanceToNow(new Date(incident.startedAt), {
                    addSuffix: true,
                })}
            </TableCell>
            <TableCell>
                <div className="flex items-center gap-2">
                    <div
                        className={cn(
                            "h-2 w-2 rounded-full",
                            displayStatus === "completed" &&
                                "bg-muted-foreground/30",
                            displayStatus === "scheduled" && "bg-blue-500",
                            displayStatus !== "completed" &&
                                displayStatus !== "scheduled" &&
                                "animate-pulse bg-red-500",
                        )}
                    />
                    <span
                        className={cn(
                            "font-medium text-sm capitalize",
                            displayStatus === "completed" &&
                                "text-muted-foreground",
                            displayStatus === "scheduled" && "text-blue-500",
                            displayStatus !== "completed" &&
                                displayStatus !== "scheduled" &&
                                "text-red-500",
                        )}
                    >
                        {displayStatus.replace("_", " ")}
                    </span>
                </div>
            </TableCell>
            <TableCell
                className="w-[52px] pr-4"
                onPointerDown={(event) => {
                    event.stopPropagation();
                    suppressRowNavigation();
                }}
                onClick={(event) => {
                    event.stopPropagation();
                    suppressRowNavigation();
                }}
            >
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    suppressRowNavigation();
                                }}
                            />
                        }
                    >
                        <FontAwesomeIcon
                            icon={faEllipsis}
                            className="h-4 w-4"
                        />
                        <span className="sr-only">Open menu</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        onPointerDown={(event) => {
                            event.stopPropagation();
                            suppressRowNavigation();
                        }}
                        onClick={(event) => {
                            event.stopPropagation();
                            suppressRowNavigation();
                        }}
                    >
                        <DropdownMenuItem
                            render={<Link href={`/incidents/${incident.id}`} />}
                        >
                            <FontAwesomeIcon icon={faEye} className="h-4 w-4" />
                            View details
                        </DropdownMenuItem>
                        {!incident.endedAt && !incident.acknowledgedAt && (
                            <DropdownMenuItem
                                disabled={bulkIncidentAction.isPending}
                                onSelect={(event) => {
                                    event.stopPropagation();
                                    suppressRowNavigation();
                                    runBulkAction("acknowledge", [incident.id]);
                                }}
                            >
                                <FontAwesomeIcon
                                    icon={faHandshake}
                                    className="h-4 w-4"
                                />
                                Acknowledge
                            </DropdownMenuItem>
                        )}
                        {!incident.endedAt && (
                            <DropdownMenuItem
                                disabled={bulkIncidentAction.isPending}
                                onSelect={(event) => {
                                    event.stopPropagation();
                                    suppressRowNavigation();
                                    runBulkAction("resolve", [incident.id]);
                                }}
                            >
                                <FontAwesomeIcon
                                    icon={faCircleCheck}
                                    className="h-4 w-4"
                                />
                                Resolve
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            variant="destructive"
                            onSelect={(event) => {
                                event.stopPropagation();
                                suppressRowNavigation();
                                setIncidentToDelete({
                                    id: incident.id,
                                    title: incident.title,
                                });
                            }}
                        >
                            <FontAwesomeIcon
                                icon={faTrash}
                                className="h-4 w-4"
                            />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>
        </TableRow>
    );
}

function IncidentsTableDataTable15DataTable1({
    model,
}: {
    model: IncidentsTableDataTable15Model;
}) {
    const {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <>
            {isLoading ? (
                <IncidentsTableDataTable15DataTable2 model={model} />
            ) : !incidents || incidents.length === 0 ? (
                <IncidentsTableDataTable15DataTable3 model={model} />
            ) : (
                incidents.map((incident) => {
                    const isSelected = selectedIncidentIds.has(incident.id);
                    const displayStatus = getIncidentDisplayStatus(incident);
                    return (
                        <IncidentTableRow
                            key={incident.id}
                            model={model}
                            incident={incident}
                            isSelected={isSelected}
                            displayStatus={displayStatus}
                        />
                    );
                })
            )}
        </>
    );
}
function IncidentsTableDataTable15View({
    model,
}: {
    model: IncidentsTableDataTable15Model;
}) {
    const {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <>
            <IncidentsTableDataTable15DataTable1 model={model} />
        </>
    );
}

function IncidentsTableDataTable15({ model }: { model: IncidentsTableModel }) {
    const sectionModel = useIncidentsTableDataTable15Model({ model });
    return <IncidentsTableDataTable15View model={sectionModel} />;
}

function IncidentsTableDataTable14({ model }: { model: IncidentsTableModel }) {
    const {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <TableBody>
            <IncidentsTableDataTable15 model={model} />
        </TableBody>
    );
}

function IncidentsTableDataTable13({ model }: { model: IncidentsTableModel }) {
    const {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <Table>
            <TableHeader>
                <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12 pr-0 pl-4">
                        <span className="sr-only">Select</span>
                    </TableHead>
                    <TableHead className="min-w-[280px] pl-2">
                        Incident
                    </TableHead>
                    <TableHead className="w-[150px]">Started</TableHead>
                    <TableHead className="w-[150px]">Status</TableHead>
                    <TableHead className="w-[52px] pr-4 text-right">
                        <span className="sr-only">Actions</span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <IncidentsTableDataTable14 model={model} />
        </Table>
    );
}

function IncidentsTableContentSection12({
    model,
}: {
    model: IncidentsTableModel;
}) {
    const {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex min-h-12 flex-col gap-3 border-b bg-muted/20 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3 font-medium text-muted-foreground text-sm">
                    {currentPageIncidentIds.length > 0 ? (
                        <Checkbox
                            aria-label={
                                allCurrentPageSelected
                                    ? "Deselect all incidents on this page"
                                    : "Select all incidents on this page"
                            }
                            checked={allCurrentPageSelected}
                            indeterminate={
                                someCurrentPageSelected &&
                                !allCurrentPageSelected
                            }
                            onCheckedChange={(checked) =>
                                toggleCurrentPageSelection(checked === true)
                            }
                        />
                    ) : (
                        <FontAwesomeIcon
                            icon={faChevronDown}
                            className="h-4 w-4"
                        />
                    )}
                    <span>Incidents</span>
                    {total > 0 && (
                        <Badge className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                            {visibleStart}-{visibleEnd} of {total}
                        </Badge>
                    )}
                </div>
                {selectedCount > 0 && (
                    <div className="flex min-h-7 flex-wrap items-center gap-2 transition-opacity lg:justify-end">
                        <span className="mr-1 whitespace-nowrap font-medium text-foreground text-sm">
                            {formatIncidentCount(selectedCount)} selected
                        </span>
                        {/*<span className="hidden text-muted-foreground text-xs sm:inline">
								{selectedActionableCount > 0
									? `${formatIncidentCount(selectedActionableCount)} can be updated`
									: "Only delete is available for this selection"}
							</span>*/}
                        <Button
                            variant="outline"
                            size="xs"
                            onClick={() =>
                                runBulkAction(
                                    "acknowledge",
                                    selectedUnacknowledgedOpenIds,
                                )
                            }
                            disabled={
                                bulkIncidentAction.isPending ||
                                selectedUnacknowledgedOpenIds.length === 0
                            }
                        >
                            <FontAwesomeIcon
                                icon={faHandshake}
                                className="h-4 w-4"
                            />
                            <span className="hidden sm:inline">
                                Acknowledge
                                {selectedUnacknowledgedOpenIds.length > 0
                                    ? ` (${selectedUnacknowledgedOpenIds.length})`
                                    : ""}
                            </span>
                        </Button>
                        <Button
                            variant="outline"
                            size="xs"
                            onClick={() =>
                                runBulkAction("resolve", selectedOpenIds)
                            }
                            disabled={
                                bulkIncidentAction.isPending ||
                                selectedOpenIds.length === 0
                            }
                        >
                            <FontAwesomeIcon
                                icon={faCircleCheck}
                                className="h-4 w-4"
                            />
                            <span className="hidden sm:inline">
                                Resolve
                                {selectedOpenIds.length > 0
                                    ? ` (${selectedOpenIds.length})`
                                    : ""}
                            </span>
                        </Button>
                        <Button
                            variant="outline"
                            size="xs"
                            onClick={openMergeDialog}
                            disabled={
                                bulkIncidentAction.isPending ||
                                mergeIncidents.isPending ||
                                selectedCount < 2
                            }
                        >
                            <FontAwesomeIcon
                                icon={faNetworkWired}
                                className="h-4 w-4"
                            />
                            <span className="hidden sm:inline">Merge</span>
                        </Button>
                        <Button
                            variant="destructive-outline"
                            size="xs"
                            onClick={() => setBulkDeleteIds(selectedIds)}
                            disabled={bulkIncidentAction.isPending}
                        >
                            <FontAwesomeIcon
                                icon={faTrash}
                                className="h-4 w-4"
                            />
                            <span className="hidden sm:inline">Delete</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Clear selection"
                            onClick={clearSelection}
                            disabled={bulkIncidentAction.isPending}
                        >
                            <FontAwesomeIcon
                                icon={faXmark}
                                className="h-4 w-4"
                            />
                        </Button>
                    </div>
                )}
            </div>
            <IncidentsTableDataTable13 model={model} />

            {totalPages > 1 && (
                <div className="flex items-center justify-end border-t bg-muted/20 px-4 py-3">
                    <Pagination className="mx-0 w-auto">
                        <PaginationContent>
                            <PaginationItem>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={page === 1}
                                    onClick={() =>
                                        void setFilters({ page: page - 1 })
                                    }
                                >
                                    <FontAwesomeIcon
                                        icon={faChevronLeft}
                                        className="h-4 w-4"
                                    />
                                </Button>
                            </PaginationItem>
                            {Array.from(
                                { length: totalPages },
                                (_, i) => i + 1,
                            ).map((p) => {
                                // Simple logic for small page counts. For larger, we need ellipsis logic.
                                // For now, let's keep it simple or implement a window.
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
                                            variant={
                                                p === page ? "outline" : "ghost"
                                            }
                                            size="icon"
                                            onClick={() =>
                                                void setFilters({ page: p })
                                            }
                                            className="h-8 w-8"
                                        >
                                            {p}
                                        </Button>
                                    </PaginationItem>
                                );
                            })}
                            <PaginationItem>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                        void setFilters({ page: page + 1 })
                                    }
                                    disabled={page === totalPages}
                                >
                                    <FontAwesomeIcon
                                        icon={faChevronRight}
                                        className="h-4 w-4"
                                    />
                                </Button>
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </div>
            )}
        </div>
    );
}
function IncidentsTableView({ model }: { model: IncidentsTableModel }) {
    const {
        router,
        suppressRowNavigationRef,
        suppressRowNavigationTimeoutRef,
        searchOpen,
        setSearchOpen,
        filtersOpen,
        setFiltersOpen,
        filters,
        setFilters,
        search,
        statusFilter,
        severityFilter,
        typeFilter,
        monitorFilter,
        statusPageFilter,
        pageParam,
        pageSizeParam,
        page,
        selectedIncidentIds,
        setSelectedIncidentIds,
        previousSelectionScope,
        setPreviousSelectionScope,
        mergeOpen,
        setMergeOpen,
        mergePrimaryIncidentId,
        setMergePrimaryIncidentId,
        bulkDeleteIds,
        setBulkDeleteIds,
        incidentToDelete,
        setIncidentToDelete,
        pageSize,
        searchInput,
        setSearchInput,
        previousSearch,
        setPreviousSearch,
        debouncedSearch,
        setDebouncedSearch,
        suppressRowNavigation,
        handleIncidentRowClick,
        data,
        isLoading,
        monitorsData,
        statusPagesData,
        incidents,
        monitors,
        statusPages,
        total,
        totalPages,
        currentPageIncidentIds,
        selectionScope,
        selectedIds,
        selectedIncidents,
        selectedOpenIds,
        selectedUnacknowledgedOpenIds,
        selectedCount,
        visibleStart,
        visibleEnd,
        allCurrentPageSelected,
        someCurrentPageSelected,
        queryClient,
        deleteIncident,
        isDeleting,
        bulkIncidentAction,
        mergeIncidents,
        clearSelection,
        toggleIncidentSelection,
        toggleCurrentPageSelection,
        runBulkAction,
        openMergeDialog,
        runMergeAction,
        clearFilters,
        activeFilterCount,
    } = model;
    return (
        <div className="mx-auto w-full max-w-6xl space-y-4">
            <IncidentsTableDialog1 model={model} />
            <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
                <DialogContent className="flex items-center justify-center border-none bg-transparent p-0 shadow-none sm:max-w-[425px]">
                    <DialogTitle className="sr-only">Search</DialogTitle>
                    <div className="relative w-full">
                        <Input
                            autoFocus
                            placeholder="Search incidents..."
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
            <IncidentsTableContentSection2 model={model} />

            <IncidentsTableContentSection12 model={model} />

            <AlertDialog
                open={bulkDeleteIds.length > 0}
                onOpenChange={(open) => {
                    if (!open && !bulkIncidentAction.isPending) {
                        setBulkDeleteIds([]);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete selected incidents?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently
                            delete {formatIncidentCount(bulkDeleteIds.length)}{" "}
                            and all of their activity history.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            disabled={bulkIncidentAction.isPending}
                        >
                            Cancel
                        </AlertDialogCancel>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() =>
                                runBulkAction("delete", bulkDeleteIds)
                            }
                            disabled={bulkIncidentAction.isPending}
                        >
                            {bulkIncidentAction.isPending ? (
                                <>
                                    <FontAwesomeIcon
                                        icon={faSpinner}
                                        className="mr-2 h-4 w-4 animate-spin"
                                    />
                                    Deleting...
                                </>
                            ) : (
                                "Delete"
                            )}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={!!incidentToDelete}
                onOpenChange={(open) => !open && setIncidentToDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently
                            delete the incident &quot;
                            {incidentToDelete?.title}&quot; and all of its
                            activity history.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>
                            Cancel
                        </AlertDialogCancel>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() =>
                                incidentToDelete &&
                                deleteIncident(incidentToDelete.id)
                            }
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <FontAwesomeIcon
                                        icon={faSpinner}
                                        className="mr-2 h-4 w-4 animate-spin"
                                    />
                                    Deleting...
                                </>
                            ) : (
                                "Delete"
                            )}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export function IncidentsTable() {
    const model = useIncidentsTableModel();
    return <IncidentsTableView model={model} />;
}
