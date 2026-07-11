"use client";

import {
    faBuilding,
    faChevronDown,
    faChevronLeft,
    faChevronRight,
    faEllipsis,
    faMagnifyingGlass,
    faPen,
    faPlus,
    faSignal,
    faSpinner,
    faTrash,
    faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogPanel,
    DialogPopup,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
} from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { client, orpc } from "@/utils/orpc";

interface OrganizationRow {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    createdAt: Date | string;
    memberCount: number;
    activeMonitorCount: number;
    totalMonitorCount: number;
    activeMonitorLimit: number | null;
    regionsPerMonitorLimit: number | null;
}

interface OrganizationFormState {
    activeMonitorLimit: string;
    logo: string;
    name: string;
    ownerEmail: string;
    regionsPerMonitorLimit: string;
    slug: string;
}

const emptyCreateForm: OrganizationFormState = {
    activeMonitorLimit: "",
    logo: "",
    name: "",
    ownerEmail: "",
    regionsPerMonitorLimit: "",
    slug: "",
};

function formatLimit(limit: number | null) {
    return limit === null ? "Unlimited" : String(limit);
}

function toInputValue(limit: number | null) {
    return limit === null ? "" : String(limit);
}

function toLimitValue(value: string) {
    return value.trim() === "" ? null : Number(value);
}

function slugFromName(name: string) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function hasValidLimits(
    form: Pick<
        OrganizationFormState,
        "activeMonitorLimit" | "regionsPerMonitorLimit"
    >,
) {
    for (const value of [
        form.activeMonitorLimit,
        form.regionsPerMonitorLimit,
    ]) {
        if (value.trim() === "") {
            continue;
        }

        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed < 1) {
            return false;
        }
    }

    return true;
}

function getInitials(org: OrganizationRow) {
    return org.name.slice(0, 2).toUpperCase();
}

function getUsageText(result: {
    autoPausedMonitorCount: number;
    unpublishedIncidentCount: number;
}) {
    if (
        result.autoPausedMonitorCount > 0 ||
        result.unpublishedIncidentCount > 0
    ) {
        return `Updated. Auto-paused ${result.autoPausedMonitorCount} monitor(s) and unpublished ${result.unpublishedIncidentCount} incident link(s).`;
    }

    return "Organization updated";
}

function useOrganizationsTableModel() {
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [createOpen, setCreateOpen] = useState(false);
    const [createForm, setCreateForm] =
        useState<OrganizationFormState>(emptyCreateForm);
    const [editingOrg, setEditingOrg] = useState<OrganizationRow | null>(null);
    const [editForm, setEditForm] = useState<OrganizationFormState>({
        ...emptyCreateForm,
    });
    const [deletingOrg, setDeletingOrg] = useState<OrganizationRow | null>(
        null,
    );
    const pageSize = 10;
    const queryClient = useQueryClient();

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const { data, isLoading } = useQuery(
        orpc.organizations.list.queryOptions({
            input: {
                q: debouncedSearch || undefined,
                limit: pageSize,
                offset: (page - 1) * pageSize,
            },
        }),
    );

    const organizations = (data?.items || []) as OrganizationRow[];
    const total = data?.total || 0;
    const totalPages = Math.ceil(total / pageSize);

    const invalidateOrganizations = async () => {
        await queryClient.invalidateQueries({
            queryKey: orpc.organizations.list.key(),
        });
        await queryClient.invalidateQueries({
            queryKey: orpc.organizations.getActiveQuota.key(),
        });
    };

    const createMutation = useMutation({
        mutationFn: async () =>
            client.organizations.create({
                activeMonitorLimit: toLimitValue(createForm.activeMonitorLimit),
                logo: createForm.logo.trim() || null,
                name: createForm.name.trim(),
                ownerEmail: createForm.ownerEmail.trim(),
                regionsPerMonitorLimit: toLimitValue(
                    createForm.regionsPerMonitorLimit,
                ),
                slug: createForm.slug.trim(),
            }),
        onSuccess: async () => {
            await invalidateOrganizations();
            sileo.success({ title: "Organization created" });
            setCreateOpen(false);
            setCreateForm(emptyCreateForm);
        },
        onError: (error: Error) => {
            sileo.error({
                title: error.message || "Failed to create organization",
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!editingOrg) {
                throw new Error("No organization selected");
            }

            return client.organizations.update({
                id: editingOrg.id,
                activeMonitorLimit: toLimitValue(editForm.activeMonitorLimit),
                logo: editForm.logo.trim() || null,
                name: editForm.name.trim(),
                regionsPerMonitorLimit: toLimitValue(
                    editForm.regionsPerMonitorLimit,
                ),
                slug: editForm.slug.trim(),
            });
        },
        onSuccess: async (result) => {
            await invalidateOrganizations();
            sileo.success({ title: getUsageText(result) });
            setEditingOrg(null);
        },
        onError: (error: Error) => {
            sileo.error({
                title: error.message || "Failed to update organization",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (organizationId: string) =>
            client.organizations.delete({ id: organizationId }),
        onSuccess: async () => {
            await invalidateOrganizations();
            sileo.success({ title: "Organization deleted" });
            setDeletingOrg(null);
        },
        onError: (error: Error) => {
            sileo.error({
                title: error.message || "Failed to delete organization",
            });
        },
    });

    const createCanSave =
        createForm.name.trim().length >= 2 &&
        createForm.slug.trim().length >= 2 &&
        createForm.ownerEmail.trim().length > 0 &&
        hasValidLimits(createForm);

    const editCanSave =
        editForm.name.trim().length >= 2 &&
        editForm.slug.trim().length >= 2 &&
        hasValidLimits(editForm);

    const openEditDialog = (organization: OrganizationRow) => {
        setEditingOrg(organization);
        setEditForm({
            activeMonitorLimit: toInputValue(organization.activeMonitorLimit),
            logo: organization.logo || "",
            name: organization.name,
            ownerEmail: "",
            regionsPerMonitorLimit: toInputValue(
                organization.regionsPerMonitorLimit,
            ),
            slug: organization.slug,
        });
    };

    return {
        searchQuery,
        setSearchQuery,
        debouncedSearch,
        setDebouncedSearch,
        page,
        setPage,
        createOpen,
        setCreateOpen,
        createForm,
        setCreateForm,
        editingOrg,
        setEditingOrg,
        editForm,
        setEditForm,
        deletingOrg,
        setDeletingOrg,
        pageSize,
        queryClient,
        data,
        isLoading,
        organizations,
        total,
        totalPages,
        invalidateOrganizations,
        createMutation,
        updateMutation,
        deleteMutation,
        createCanSave,
        editCanSave,
        openEditDialog,
    };
}

type OrganizationsTableModel = ReturnType<typeof useOrganizationsTableModel>;

function OrganizationsTableDataTable3({
    model,
}: {
    model: OrganizationsTableModel;
}) {
    const {
        searchQuery,
        setSearchQuery,
        debouncedSearch,
        setDebouncedSearch,
        page,
        setPage,
        createOpen,
        setCreateOpen,
        createForm,
        setCreateForm,
        editingOrg,
        setEditingOrg,
        editForm,
        setEditForm,
        deletingOrg,
        setDeletingOrg,
        pageSize,
        queryClient,
        data,
        isLoading,
        organizations,
        total,
        totalPages,
        invalidateOrganizations,
        createMutation,
        updateMutation,
        deleteMutation,
        createCanSave,
        editCanSave,
        openEditDialog,
    } = model;
    return (
        <Table>
            <TableBody>
                {isLoading ? (
                    <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                            Loading...
                        </TableCell>
                    </TableRow>
                ) : organizations.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                            <div className="flex flex-col items-center justify-center gap-2 py-6">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                                    <FontAwesomeIcon
                                        icon={faBuilding}
                                        className="h-6 w-6 text-muted-foreground"
                                    />
                                </div>
                                <p className="font-medium text-lg">
                                    No organizations found
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    {searchQuery
                                        ? "No organizations matching your search."
                                        : "No organizations created yet."}
                                </p>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : (
                    organizations.map((org) => (
                        <TableRow
                            key={org.id}
                            className="group h-[88px] hover:bg-muted/40"
                        >
                            <TableCell className="w-[56px] pl-6">
                                <Avatar className="h-10 w-10 rounded-lg">
                                    <AvatarImage
                                        src={org.logo || ""}
                                        alt={org.name}
                                    />
                                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                                        {getInitials(org)}
                                    </AvatarFallback>
                                </Avatar>
                            </TableCell>
                            <TableCell>
                                <div className="grid gap-1">
                                    <span className="font-semibold leading-none">
                                        {org.name}
                                    </span>
                                    <span className="text-muted-foreground text-sm">
                                        /{org.slug}
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                        Created{" "}
                                        {formatDistanceToNow(
                                            new Date(org.createdAt),
                                            {
                                                addSuffix: true,
                                            },
                                        )}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-1 text-muted-foreground text-sm">
                                    <span className="flex items-center gap-1.5">
                                        <FontAwesomeIcon
                                            icon={faUsers}
                                            className="h-4 w-4"
                                        />
                                        <span className="text-foreground">
                                            {org.memberCount}
                                        </span>{" "}
                                        members
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <FontAwesomeIcon
                                            icon={faSignal}
                                            className="h-4 w-4"
                                        />
                                        <span className="text-foreground">
                                            {org.activeMonitorCount}
                                        </span>{" "}
                                        active /{" "}
                                        <span className="text-foreground">
                                            {org.totalMonitorCount}
                                        </span>{" "}
                                        total
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="grid gap-1 text-sm">
                                    <span className="text-muted-foreground">
                                        Active monitor limit:{" "}
                                        <span className="font-medium text-foreground">
                                            {formatLimit(
                                                org.activeMonitorLimit,
                                            )}
                                        </span>
                                    </span>
                                    <span className="text-muted-foreground">
                                        Regions per monitor:{" "}
                                        <span className="font-medium text-foreground">
                                            {formatLimit(
                                                org.regionsPerMonitorLimit,
                                            )}
                                        </span>
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell className="w-[60px] pr-6 text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger
                                        render={
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                            />
                                        }
                                    >
                                        <FontAwesomeIcon
                                            icon={faEllipsis}
                                            className="h-4 w-4"
                                        />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                            onClick={() => openEditDialog(org)}
                                        >
                                            <FontAwesomeIcon
                                                icon={faPen}
                                                className="mr-2 h-4 w-4"
                                            />
                                            Edit Organization
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            onClick={() => setDeletingOrg(org)}
                                            className="text-red-500"
                                        >
                                            <FontAwesomeIcon
                                                icon={faTrash}
                                                className="mr-2 h-4 w-4"
                                            />
                                            Delete Organization
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    );
}

function OrganizationsTableDataTable2({
    model,
}: {
    model: OrganizationsTableModel;
}) {
    const {
        searchQuery,
        setSearchQuery,
        debouncedSearch,
        setDebouncedSearch,
        page,
        setPage,
        createOpen,
        setCreateOpen,
        createForm,
        setCreateForm,
        editingOrg,
        setEditingOrg,
        editForm,
        setEditForm,
        deletingOrg,
        setDeletingOrg,
        pageSize,
        queryClient,
        data,
        isLoading,
        organizations,
        total,
        totalPages,
        invalidateOrganizations,
        createMutation,
        updateMutation,
        deleteMutation,
        createCanSave,
        editCanSave,
        openEditDialog,
    } = model;
    return (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex min-h-12 items-center gap-2 border-b bg-muted/20 px-4 py-3 font-medium text-muted-foreground text-sm">
                <FontAwesomeIcon icon={faChevronDown} className="h-4 w-4" />
                Organizations ({total})
            </div>
            <OrganizationsTableDataTable3 model={model} />

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
                                (_, index) => index + 1,
                            ).map((pageNumber) => {
                                if (
                                    totalPages > 7 &&
                                    (pageNumber < page - 2 ||
                                        pageNumber > page + 2) &&
                                    pageNumber !== 1 &&
                                    pageNumber !== totalPages
                                ) {
                                    if (
                                        pageNumber === page - 3 ||
                                        pageNumber === page + 3
                                    ) {
                                        return (
                                            <PaginationItem key={pageNumber}>
                                                <PaginationEllipsis />
                                            </PaginationItem>
                                        );
                                    }
                                    return null;
                                }

                                return (
                                    <PaginationItem key={pageNumber}>
                                        <Button
                                            variant={
                                                pageNumber === page
                                                    ? "outline"
                                                    : "ghost"
                                            }
                                            size="icon"
                                            onClick={() => setPage(pageNumber)}
                                        >
                                            {pageNumber}
                                        </Button>
                                    </PaginationItem>
                                );
                            })}
                            <PaginationItem>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={page === totalPages}
                                    onClick={() => setPage(page + 1)}
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

function OrganizationsTableDialog1({
    model,
}: {
    model: OrganizationsTableModel;
}) {
    const {
        searchQuery,
        setSearchQuery,
        debouncedSearch,
        setDebouncedSearch,
        page,
        setPage,
        createOpen,
        setCreateOpen,
        createForm,
        setCreateForm,
        editingOrg,
        setEditingOrg,
        editForm,
        setEditForm,
        deletingOrg,
        setDeletingOrg,
        pageSize,
        queryClient,
        data,
        isLoading,
        organizations,
        total,
        totalPages,
        invalidateOrganizations,
        createMutation,
        updateMutation,
        deleteMutation,
        createCanSave,
        editCanSave,
        openEditDialog,
    } = model;
    return (
        <div className="mx-auto w-full max-w-6xl space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <h1 className="font-bold text-2xl tracking-tight">
                    Organizations
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger render={<Button />}>
                            <FontAwesomeIcon
                                icon={faPlus}
                                className="mr-2 h-4 w-4"
                            />
                            Create Organization
                        </DialogTrigger>
                        <DialogPopup className="sm:max-w-lg">
                            <DialogHeader>
                                <DialogTitle>Create Organization</DialogTitle>
                                <DialogDescription>
                                    Create an organization for an existing owner
                                    user.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogPanel className="grid gap-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="create-org-name">
                                            Name
                                        </Label>
                                        <Input
                                            id="create-org-name"
                                            value={createForm.name}
                                            onChange={(event) => {
                                                const name = event.target.value;
                                                setCreateForm((current) => ({
                                                    ...current,
                                                    name,
                                                    slug: slugFromName(name),
                                                }));
                                            }}
                                            placeholder="Acme Corp"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="create-org-slug">
                                            Slug
                                        </Label>
                                        <Input
                                            id="create-org-slug"
                                            value={createForm.slug}
                                            onChange={(event) =>
                                                setCreateForm((current) => ({
                                                    ...current,
                                                    slug: event.target.value,
                                                }))
                                            }
                                            placeholder="acme-corp"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="create-owner-email">
                                        Owner Email
                                    </Label>
                                    <Input
                                        id="create-owner-email"
                                        type="email"
                                        value={createForm.ownerEmail}
                                        onChange={(event) =>
                                            setCreateForm((current) => ({
                                                ...current,
                                                ownerEmail: event.target.value,
                                            }))
                                        }
                                        placeholder="owner@example.com"
                                    />
                                </div>
                                <OrganizationFields
                                    form={createForm}
                                    idPrefix="create"
                                    setForm={setCreateForm}
                                />
                            </DialogPanel>
                            <DialogFooter>
                                <DialogClose
                                    render={<Button variant="ghost" />}
                                >
                                    Cancel
                                </DialogClose>
                                <Button
                                    onClick={() => createMutation.mutate()}
                                    disabled={
                                        !createCanSave ||
                                        createMutation.isPending
                                    }
                                >
                                    {createMutation.isPending && (
                                        <FontAwesomeIcon
                                            icon={faSpinner}
                                            className="mr-2 h-4 w-4 animate-spin"
                                        />
                                    )}
                                    Create Organization
                                </Button>
                            </DialogFooter>
                        </DialogPopup>
                    </Dialog>
                    <div className="relative w-full sm:w-64">
                        <FontAwesomeIcon
                            icon={faMagnifyingGlass}
                            className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground"
                        />
                        <Input
                            placeholder="Search by name or slug"
                            className="pl-8"
                            value={searchQuery}
                            onChange={(event) =>
                                setSearchQuery(event.target.value)
                            }
                        />
                    </div>
                </div>
            </div>

            <OrganizationsTableDataTable2 model={model} />
        </div>
    );
}
function OrganizationsTableView({ model }: { model: OrganizationsTableModel }) {
    const {
        searchQuery,
        setSearchQuery,
        debouncedSearch,
        setDebouncedSearch,
        page,
        setPage,
        createOpen,
        setCreateOpen,
        createForm,
        setCreateForm,
        editingOrg,
        setEditingOrg,
        editForm,
        setEditForm,
        deletingOrg,
        setDeletingOrg,
        pageSize,
        queryClient,
        data,
        isLoading,
        organizations,
        total,
        totalPages,
        invalidateOrganizations,
        createMutation,
        updateMutation,
        deleteMutation,
        createCanSave,
        editCanSave,
        openEditDialog,
    } = model;
    return (
        <>
            <OrganizationsTableDialog1 model={model} />

            <Dialog
                open={!!editingOrg}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditingOrg(null);
                    }
                }}
            >
                <DialogPopup className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit Organization</DialogTitle>
                        <DialogDescription>
                            Update organization details and quota limits.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogPanel className="grid gap-4">
                        <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                            <p>
                                Current active usage:{" "}
                                <span className="font-medium">
                                    {editingOrg?.activeMonitorCount ?? 0}
                                </span>
                            </p>
                            <p className="text-muted-foreground">
                                Total saved monitors:{" "}
                                {editingOrg?.totalMonitorCount ?? 0}
                            </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="edit-org-name">Name</Label>
                                <Input
                                    id="edit-org-name"
                                    value={editForm.name}
                                    onChange={(event) =>
                                        setEditForm((current) => ({
                                            ...current,
                                            name: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-org-slug">Slug</Label>
                                <Input
                                    id="edit-org-slug"
                                    value={editForm.slug}
                                    onChange={(event) =>
                                        setEditForm((current) => ({
                                            ...current,
                                            slug: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                        <OrganizationFields
                            form={editForm}
                            idPrefix="edit"
                            setForm={setEditForm}
                        />
                    </DialogPanel>
                    <DialogFooter>
                        <DialogClose render={<Button variant="ghost" />}>
                            Cancel
                        </DialogClose>
                        <Button
                            onClick={() => updateMutation.mutate()}
                            disabled={
                                !editingOrg ||
                                !editCanSave ||
                                updateMutation.isPending
                            }
                        >
                            {updateMutation.isPending && (
                                <FontAwesomeIcon
                                    icon={faSpinner}
                                    className="mr-2 h-4 w-4 animate-spin"
                                />
                            )}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogPopup>
            </Dialog>

            <AlertDialog
                open={!!deletingOrg}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeletingOrg(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete organization?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete{" "}
                            <span className="font-semibold">
                                {deletingOrg?.name}
                            </span>{" "}
                            and its monitors, status pages, incidents,
                            maintenance windows, integrations, API keys,
                            members, and invitations.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteMutation.isPending}>
                            Cancel
                        </AlertDialogCancel>
                        <Button
                            type="button"
                            onClick={() => {
                                if (deletingOrg) {
                                    deleteMutation.mutate(deletingOrg.id);
                                }
                            }}
                            disabled={deleteMutation.isPending}
                            variant="destructive"
                        >
                            {deleteMutation.isPending && (
                                <FontAwesomeIcon
                                    icon={faSpinner}
                                    className="mr-2 h-4 w-4 animate-spin"
                                />
                            )}
                            Delete Organization
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

export function OrganizationsTable() {
    const model = useOrganizationsTableModel();
    return <OrganizationsTableView model={model} />;
}

function OrganizationFields({
    form,
    idPrefix,
    setForm,
}: {
    form: OrganizationFormState;
    idPrefix: string;
    setForm: Dispatch<SetStateAction<OrganizationFormState>>;
}) {
    const validLimits = hasValidLimits(form);

    return (
        <>
            <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-org-logo`}>Logo URL</Label>
                <Input
                    id={`${idPrefix}-org-logo`}
                    value={form.logo}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            logo: event.target.value,
                        }))
                    }
                    placeholder="https://example.com/logo.png"
                />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}-active-limit`}>
                        Active monitor limit
                    </Label>
                    <Input
                        id={`${idPrefix}-active-limit`}
                        type="number"
                        min={1}
                        placeholder="Unlimited"
                        value={form.activeMonitorLimit}
                        onChange={(event) =>
                            setForm((current) => ({
                                ...current,
                                activeMonitorLimit: event.target.value,
                            }))
                        }
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}-regions-limit`}>
                        Regions per monitor
                    </Label>
                    <Input
                        id={`${idPrefix}-regions-limit`}
                        type="number"
                        min={1}
                        placeholder="Unlimited"
                        value={form.regionsPerMonitorLimit}
                        onChange={(event) =>
                            setForm((current) => ({
                                ...current,
                                regionsPerMonitorLimit: event.target.value,
                            }))
                        }
                    />
                </div>
            </div>
            {!validLimits && (
                <p className="text-destructive text-sm">
                    Limits must be whole numbers greater than or equal to 1, or
                    left blank for unlimited.
                </p>
            )}
        </>
    );
}
