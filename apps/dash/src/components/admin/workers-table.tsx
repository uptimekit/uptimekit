"use client";

import {
    faChevronDown,
    faChevronLeft,
    faChevronRight,
    faEllipsis,
    faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    getWorkerAvailabilityStatus,
    type WorkerAvailabilityStatus,
} from "@uptimekit/api/lib/worker-status";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useEffect, useState } from "react";
import { sileo } from "sileo";
import { CreateWorkerDialog } from "@/components/admin/create-worker-dialog";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
} from "@/components/ui/pagination";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { getRegionInfo, isFontAwesomeRegionFlag } from "@/lib/regions";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

const workerStatusOptions = [
    { label: "All Statuses", value: "all" },
    { label: "Online", value: "online" },
    { label: "Offline", value: "offline" },
    { label: "Unknown", value: "unknown" },
] as const;

const workerStatusMeta: Record<
    WorkerAvailabilityStatus,
    { dotClassName: string; label: string; textClassName: string }
> = {
    online: {
        dotClassName: "bg-emerald-500 shadow-emerald-500/20",
        label: "Online",
        textClassName: "text-emerald-500",
    },
    offline: {
        dotClassName: "bg-red-500 shadow-red-500/20",
        label: "Offline",
        textClassName: "text-red-500",
    },
    unknown: {
        dotClassName: "bg-gray-400 shadow-gray-400/20",
        label: "Unknown",
        textClassName: "text-gray-500",
    },
};

/**
 * Render a paginated, searchable table for managing workers with status filtering, creation, and deletion workflows.
 *
 * Shows loading and empty states, per-worker actions (edit, rotate token, delete with confirmation), region info, last-seen timestamps, and pagination controls.
 *
 * @returns The rendered JSX element for the Workers table and its associated controls.
 */
export function WorkersTable() {
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<
        "all" | "online" | "offline" | "unknown"
    >("all");
    const [page, setPage] = useState(1);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [workerToDelete, setWorkerToDelete] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [currentTime, setCurrentTime] = useState(() => new Date());
    const pageSize = 10;
    const queryClient = useQueryClient();

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setCurrentTime(new Date());
        }, 60 * 1000);

        return () => window.clearInterval(timer);
    }, []);

    const { data, isLoading } = useQuery({
        ...orpc.workers.list.queryOptions({
            input: {
                q: debouncedSearch || undefined,
                status: statusFilter,
                limit: pageSize,
                offset: (page - 1) * pageSize,
            },
        }),
        refetchInterval: 60 * 1000,
    });

    const deleteMutation = useMutation({
        ...orpc.workers.delete.mutationOptions(),
        onSuccess: () => {
            sileo.success({ title: "Worker deleted successfully" });
            queryClient.invalidateQueries({
                queryKey: orpc.workers.list.key(),
            });
            setDeleteDialogOpen(false);
            setWorkerToDelete(null);
        },
        onError: (error: Error) => {
            sileo.error({ title: error.message || "Failed to delete worker" });
        },
    });

    const handleDeleteClick = (workerId: string, workerName: string) => {
        setWorkerToDelete({ id: workerId, name: workerName });
        setDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (workerToDelete) {
            deleteMutation.mutate({ id: workerToDelete.id });
        }
    };

    const workers = data?.items || [];
    const total = data?.total || 0;
    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="mx-auto w-full max-w-6xl space-y-4">
            <div className="flex items-center justify-between gap-4">
                <h1 className="font-bold text-2xl tracking-tight">Workers</h1>
                <div className="flex items-center gap-2">
                    <div className="relative w-64">
                        <FontAwesomeIcon
                            icon={faMagnifyingGlass}
                            className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground"
                        />
                        <Input
                            placeholder="Search"
                            className="pl-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Select
                        value={statusFilter}
                        onValueChange={(val) => {
                            setStatusFilter(val as any);
                            setPage(1);
                        }}
                    >
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Status">
                                {
                                    workerStatusOptions.find(
                                        (option) =>
                                            option.value === statusFilter,
                                    )?.label
                                }
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {workerStatusOptions.map(({ label, value }) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <CreateWorkerDialog />
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="flex min-h-12 items-center gap-2 border-b bg-muted/20 px-4 py-3 font-medium text-muted-foreground text-sm">
                    <FontAwesomeIcon icon={faChevronDown} className="h-4 w-4" />
                    Workers
                </div>
                <Table>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell
                                    colSpan={4}
                                    className="h-24 text-center"
                                >
                                    Loading...
                                </TableCell>
                            </TableRow>
                        ) : workers.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={4}
                                    className="h-24 text-center"
                                >
                                    <div className="flex flex-col items-center justify-center gap-2 py-6">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                                            <FontAwesomeIcon
                                                icon={faMagnifyingGlass}
                                                className="h-6 w-6 text-muted-foreground"
                                            />
                                        </div>
                                        <p className="font-medium text-lg">
                                            No workers found
                                        </p>
                                        <p className="text-muted-foreground text-sm">
                                            {searchQuery ||
                                            statusFilter !== "all"
                                                ? "No workers matching your search."
                                                : "Get started by adding your first worker."}
                                        </p>
                                        {!searchQuery &&
                                            statusFilter === "all" && (
                                                <div className="mt-2">
                                                    <CreateWorkerDialog />
                                                </div>
                                            )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            workers.map((worker) => {
                                const status = getWorkerAvailabilityStatus({
                                    active: worker.active,
                                    lastHeartbeat: worker.lastHeartbeat,
                                    now: currentTime,
                                });
                                const statusMeta = workerStatusMeta[status];

                                return (
                                    <TableRow
                                        key={worker.id}
                                        className="group h-[72px] cursor-pointer hover:bg-muted/40"
                                    >
                                        <TableCell className="w-[50px] pl-6">
                                            <div
                                                className={cn(
                                                    "h-2.5 w-2.5 rounded-full shadow-sm",
                                                    statusMeta.dotClassName,
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
                                                        className={
                                                            statusMeta.textClassName
                                                        }
                                                    >
                                                        {statusMeta.label}
                                                    </span>
                                                    <span>·</span>
                                                    <span className="flex items-center gap-1.5 align-middle">
                                                        {(() => {
                                                            const regionInfo =
                                                                getRegionInfo(
                                                                    worker.location,
                                                                );
                                                            const Flag =
                                                                regionInfo.Flag;
                                                            return (
                                                                <>
                                                                    {isFontAwesomeRegionFlag(
                                                                        Flag,
                                                                    ) ? (
                                                                        <FontAwesomeIcon
                                                                            icon={
                                                                                Flag
                                                                            }
                                                                            className="size-3.5 shrink-0 rounded-sm"
                                                                        />
                                                                    ) : (
                                                                        <Flag className="size-3.5 shrink-0 rounded-sm" />
                                                                    )}
                                                                    <span>
                                                                        {
                                                                            regionInfo.label
                                                                        }
                                                                    </span>
                                                                </>
                                                            );
                                                        })()}
                                                    </span>
                                                    <span>·</span>
                                                    <span>
                                                        Last seen{" "}
                                                        {worker.lastHeartbeat
                                                            ? formatDistanceToNow(
                                                                  new Date(
                                                                      worker.lastHeartbeat,
                                                                  ),
                                                                  {
                                                                      addSuffix: true,
                                                                  },
                                                              )
                                                            : "Never"}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="w-[200px] text-right font-medium text-muted-foreground text-sm" />
                                        <TableCell className="w-[50px] pr-4">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger
                                                    render={
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                                                        />
                                                    }
                                                >
                                                    <FontAwesomeIcon
                                                        icon={faEllipsis}
                                                        className="h-4 w-4"
                                                    />
                                                    <span className="sr-only">
                                                        Open menu
                                                    </span>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        render={
                                                            <Link
                                                                href={`/admin/workers/${worker.id}`}
                                                            />
                                                        }
                                                    >
                                                        Edit worker
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem>
                                                        Rotate Token
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-red-500"
                                                        variant="destructive"
                                                        onClick={() =>
                                                            handleDeleteClick(
                                                                worker.id,
                                                                worker.name,
                                                            )
                                                        }
                                                    >
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>

                {totalPages > 1 && (
                    <div className="flex items-center justify-end border-t bg-muted/20 px-4 py-3">
                        <Pagination className="mx-0 w-auto">
                            <PaginationContent>
                                <PaginationItem>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={page === 1}
                                        onClick={() => setPage(page - 1)}
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
                                                    p === page
                                                        ? "outline"
                                                        : "ghost"
                                                }
                                                size="icon"
                                                onClick={() => setPage(p)}
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
                                        onClick={() => setPage(page + 1)}
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

            <AlertDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the worker{" "}
                            <span className="font-semibold">
                                {workerToDelete?.name}
                            </span>{" "}
                            and its associated API keys. This action cannot be
                            undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={confirmDelete}
                        >
                            Delete Worker
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
