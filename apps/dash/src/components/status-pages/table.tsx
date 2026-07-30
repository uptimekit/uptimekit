"use client";

import {
    faArrowRight,
    faChartColumn,
    faCheck,
    faChevronDown,
    faEllipsis,
    faFilter,
    faGlobe,
    faLock,
    faMagnifyingGlass,
    faPlus,
    faSpinner,
    faUpRightFromSquare,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useStatusPageDomain } from "@/components/providers/status-page-domain-provider";
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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { getStatusPageUrl } from "@/lib/status-page-url";
import { client, orpc } from "@/utils/orpc";
import { DataPagination } from "../ui/data-pagination";
import { MenuGroup, MenuGroupLabel } from "../ui/menu";
import { CreateStatusPageForm } from "./create-form";

interface StatusPageListItem {
    id: string;
    name: string;
    slug: string;
    domain: string | null;
    monitorsCount: number;
    subscribers: number;
    public: boolean;
    description: string | null;
}

function StatusPageRow({
    page,
    onOpen,
    onDelete,
}: {
    page: StatusPageListItem;
    onOpen: () => void;
    onDelete: () => void;
}) {
    const statusPageDomain = useStatusPageDomain();
    const statusPageUrl = getStatusPageUrl(page, statusPageDomain);
    return (
        <TableRow
            className="group h-[72px] cursor-pointer hover:bg-muted/40"
            onClick={onOpen}
        >
            <TableCell className="pl-6">
                <div className="grid gap-1">
                    <span className="flex items-center gap-2 font-semibold leading-none transition-colors group-hover:text-primary">
                        {page.name}
                        {!page.public && (
                            <FontAwesomeIcon
                                icon={faLock}
                                className="h-3 w-3 text-muted-foreground"
                            />
                        )}
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
                        {statusPageUrl}
                        <FontAwesomeIcon
                            icon={faUpRightFromSquare}
                            className="h-3 w-3 opacity-50"
                        />
                    </span>
                </div>
            </TableCell>
            <TableCell className="w-auto pr-1 md:w-[200px]">
                <div className="flex items-center gap-2 text-muted-foreground text-sm md:gap-4">
                    <div className="flex items-center gap-1.5" title="Monitors">
                        <FontAwesomeIcon
                            icon={faGlobe}
                            className="h-4 w-4 opacity-70"
                        />
                        <span>{page.monitorsCount}</span>
                    </div>
                    <div
                        className="flex items-center gap-1.5"
                        title="Subscribers"
                    >
                        <FontAwesomeIcon
                            icon={faChartColumn}
                            className="h-4 w-4 opacity-70"
                        />
                        <span>{page.subscribers}</span>
                    </div>
                </div>
            </TableCell>
            <TableCell className="w-[50px] pr-4">
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={(event) => event.stopPropagation()}
                            />
                        }
                    >
                        <FontAwesomeIcon
                            icon={faEllipsis}
                            className="h-4 w-4"
                        />
                        <span className="sr-only">Open menu</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <MenuGroup>
                            <MenuGroupLabel>{page.name}</MenuGroupLabel>
                            <DropdownMenuItem
                                render={
                                    <a
                                        aria-label={`Open ${page.name} status page`}
                                        href={statusPageUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    />
                                }
                                onClick={(event) => event.stopPropagation()}
                            >
                                View page
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-red-500 focus:text-red-600"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onDelete();
                                }}
                            >
                                Delete
                            </DropdownMenuItem>
                        </MenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>
        </TableRow>
    );
}

function StatusPagesToolbar({
    search,
    searchOpen,
    publicFilter,
    activeFilterCount,
    onSearchChange,
    onSearchOpenChange,
    onPublicFilterChange,
    onClearFilters,
    onCreate,
}: {
    search: string;
    searchOpen: boolean;
    publicFilter: boolean | undefined;
    activeFilterCount: number;
    onSearchChange: (value: string) => void;
    onSearchOpenChange: (open: boolean) => void;
    onPublicFilterChange: (value: boolean | undefined) => void;
    onClearFilters: () => void;
    onCreate: () => void;
}) {
    return (
        <>
            <Dialog open={searchOpen} onOpenChange={onSearchOpenChange}>
                <DialogContent className="flex items-center justify-center border-none bg-transparent p-0 shadow-none sm:max-w-[425px]">
                    <DialogTitle className="sr-only">Search</DialogTitle>
                    <div className="relative w-full">
                        <Input
                            autoFocus
                            placeholder="Search status pages..."
                            className="h-12 rounded-full border-muted bg-background pr-12 pl-6 shadow-lg"
                            value={search}
                            onChange={(event) =>
                                onSearchChange(event.target.value)
                            }
                            onKeyDown={(event) => {
                                if (event.key === "Enter")
                                    onSearchOpenChange(false);
                            }}
                        />
                        <Button
                            size="icon"
                            className="absolute top-1 right-1 h-10 w-10 rounded-full"
                            onClick={() => onSearchOpenChange(false)}
                        >
                            <FontAwesomeIcon
                                icon={faArrowRight}
                                className="h-4 w-4"
                            />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            <div className="flex items-center justify-between gap-4">
                <h1 className="font-bold text-2xl tracking-tight">
                    Status Pages
                </h1>
                <div className="flex items-center gap-2">
                    <div className="relative hidden w-64 md:block">
                        <FontAwesomeIcon
                            icon={faMagnifyingGlass}
                            className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground"
                        />
                        <Input
                            placeholder="Search status pages..."
                            className="pl-8"
                            value={search}
                            onChange={(event) =>
                                onSearchChange(event.target.value)
                            }
                        />
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        className="relative md:hidden"
                        onClick={() => onSearchOpenChange(true)}
                    >
                        <FontAwesomeIcon
                            icon={faMagnifyingGlass}
                            className="h-4 w-4"
                        />
                        {search && (
                            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary" />
                        )}
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="relative"
                                />
                            }
                        >
                            <FontAwesomeIcon
                                icon={faFilter}
                                className="h-4 w-4"
                            />
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground">
                                    {activeFilterCount}
                                </span>
                            )}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 p-2">
                            <div className="mb-2 px-2 font-semibold text-muted-foreground text-xs uppercase">
                                Visibility
                            </div>
                            {(
                                [
                                    ["All", undefined],
                                    ["Public", true],
                                    ["Private", false],
                                ] as const
                            ).map(([label, value]) => (
                                <DropdownMenuItem
                                    key={label}
                                    onClick={() => onPublicFilterChange(value)}
                                    className="flex justify-between"
                                >
                                    {label}
                                    {publicFilter === value && (
                                        <FontAwesomeIcon
                                            icon={faCheck}
                                            className="h-4 w-4"
                                        />
                                    )}
                                </DropdownMenuItem>
                            ))}
                            {publicFilter !== undefined && (
                                <>
                                    <div className="my-2 h-px bg-muted" />
                                    <DropdownMenuItem
                                        onClick={onClearFilters}
                                        className="justify-center text-red-500 hover:text-red-600"
                                    >
                                        Clear filters
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                        className="w-9 gap-2 border-none bg-white p-0 text-black shadow-md shadow-white/10 hover:bg-gray-100 md:w-auto md:px-4"
                        onClick={onCreate}
                    >
                        <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
                        <span className="hidden md:inline">
                            Create status page
                        </span>
                    </Button>
                </div>
            </div>
        </>
    );
}

export function StatusPagesTable() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [createOpen, setCreateOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [pageToDelete, setPageToDelete] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [publicFilter, setPublicFilter] = useState<boolean | undefined>(
        undefined,
    );
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const pageSize = 10;

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const { data, isLoading } = useQuery(
        orpc.statusPages.list.queryOptions({
            input: {
                q: debouncedSearch || undefined,
                public: publicFilter,
                limit: pageSize,
                offset: (page - 1) * pageSize,
            },
        }),
    );

    const statusPages = data?.items;
    const total = data?.total || 0;
    const totalPages = Math.ceil(total / pageSize);

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await client.statusPages.delete({ id });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: orpc.statusPages.list.queryKey({
                    input: {
                        q: debouncedSearch || undefined,
                        public: publicFilter,
                        limit: pageSize,
                        offset: (page - 1) * pageSize,
                    },
                }),
            });
            setDeleteDialogOpen(false);
            setPageToDelete(null);
        },
    });

    const handleDeleteClick = (page: { id: string; name: string }) => {
        setPageToDelete(page);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = () => {
        if (pageToDelete) {
            deleteMutation.mutate(pageToDelete.id);
        }
    };

    const clearFilters = () => {
        setSearch("");
        setPublicFilter(undefined);
        setPage(1);
    };

    const activeFilterCount = [publicFilter !== undefined].filter(
        Boolean,
    ).length;

    return (
        <div className="mx-auto w-full max-w-6xl space-y-4">
            <CreateStatusPageForm
                open={createOpen}
                onOpenChange={setCreateOpen}
            />
            <StatusPagesToolbar
                search={search}
                searchOpen={searchOpen}
                publicFilter={publicFilter}
                activeFilterCount={activeFilterCount}
                onSearchChange={setSearch}
                onSearchOpenChange={setSearchOpen}
                onPublicFilterChange={(value) => {
                    setPublicFilter(value);
                    setPage(1);
                }}
                onClearFilters={clearFilters}
                onCreate={() => setCreateOpen(true)}
            />

            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="flex min-h-12 items-center gap-2 border-b bg-muted/20 px-4 py-3 font-medium text-muted-foreground text-sm">
                    <FontAwesomeIcon icon={faChevronDown} className="h-4 w-4" />
                    Status Pages
                </div>
                <Table>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell
                                    colSpan={3}
                                    className="py-8 text-center"
                                >
                                    <FontAwesomeIcon
                                        icon={faSpinner}
                                        className="mx-auto h-6 w-6 animate-spin text-muted-foreground"
                                    />
                                </TableCell>
                            </TableRow>
                        ) : !statusPages || statusPages.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={3}
                                    className="h-24 text-center"
                                >
                                    <div className="flex flex-col items-center justify-center gap-2 py-6">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                                            <FontAwesomeIcon
                                                icon={faGlobe}
                                                className="h-6 w-6 text-muted-foreground"
                                            />
                                        </div>
                                        <p className="font-medium text-lg">
                                            No status pages found
                                        </p>
                                        <p className="text-muted-foreground text-sm">
                                            {search ||
                                            publicFilter !== undefined
                                                ? "Try adjusting your filters"
                                                : "Get started by creating your first status page."}
                                        </p>
                                        {!search &&
                                            publicFilter === undefined && (
                                                <div className="mt-2">
                                                    <Button
                                                        onClick={() =>
                                                            setCreateOpen(true)
                                                        }
                                                    >
                                                        Create status page
                                                    </Button>
                                                </div>
                                            )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            statusPages.map(
                                (statusPage: StatusPageListItem) => (
                                    <StatusPageRow
                                        key={statusPage.id}
                                        page={statusPage}
                                        onOpen={() =>
                                            router.push(
                                                `/status-pages/${statusPage.id}/settings`,
                                            )
                                        }
                                        onDelete={() =>
                                            handleDeleteClick(statusPage)
                                        }
                                    />
                                ),
                            )
                        )}
                    </TableBody>
                </Table>

                <DataPagination
                    page={page}
                    totalPages={totalPages}
                    setPage={setPage}
                />
            </div>

            <AlertDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete status page</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete{" "}
                            <span className="font-semibold">
                                {pageToDelete?.name}
                            </span>
                            ? This action cannot be undone and will permanently
                            remove all associated data including monitors,
                            groups, and reports.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteMutation.isPending}>
                            Cancel
                        </AlertDialogCancel>
                        <Button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteConfirm();
                            }}
                            disabled={deleteMutation.isPending}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            {deleteMutation.isPending ? (
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
