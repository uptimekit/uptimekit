"use client";

import {
    faBan,
    faChevronDown,
    faChevronLeft,
    faChevronRight,
    faEllipsis,
    faMagnifyingGlass,
    faPen,
    faPlus,
    faShieldHalved,
    faSpinner,
    faTrash,
    faUserXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { client, orpc } from "@/utils/orpc";

interface User {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: string | null;
    banned: boolean | null;
    banReason: string | null;
    banExpires: Date | string | null;
    createdAt: Date | string;
}

type UserRole = "admin" | "user";
type UserStatus = "active" | "banned";

const roleFilterOptions = [
    { label: "All Roles", value: "all" },
    { label: "Admins", value: "admin" },
    { label: "Users", value: "user" },
] as const;

const statusFilterOptions = [
    { label: "All Statuses", value: "all" },
    { label: "Active", value: "active" },
    { label: "Banned", value: "banned" },
] as const;

const roleOptions = [
    { label: "User", value: "user" },
    { label: "Admin", value: "admin" },
] as const;

const statusOptions = [
    { label: "Active", value: "active" },
    { label: "Banned", value: "banned" },
] as const;

function getUserRole(user: User): UserRole {
    return user.role === "admin" ? "admin" : "user";
}

function getInitials(user: User) {
    return (user.name || user.email).slice(0, 2).toUpperCase();
}

function toDateTimeLocal(value: Date | string | null) {
    if (!value) {
        return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const localDate = new Date(
        date.getTime() - date.getTimezoneOffset() * 60_000,
    );
    return localDate.toISOString().slice(0, 16);
}

function toIsoDateTime(value: string) {
    return value ? new Date(value).toISOString() : null;
}

export function UsersTable() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">(
        "all",
    );
    const [statusFilter, setStatusFilter] = useState<
        "all" | "active" | "banned"
    >("all");
    const [page, setPage] = useState(1);
    const [createOpen, setCreateOpen] = useState(false);
    const [createForm, setCreateForm] = useState({
        email: "",
        name: "",
        password: "",
        role: "user" as UserRole,
    });
    const [editOpen, setEditOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editForm, setEditForm] = useState({
        banExpires: "",
        banReason: "",
        email: "",
        image: "",
        name: "",
        newPassword: "",
        role: "user" as UserRole,
        status: "active" as UserStatus,
    });
    const [deletingUser, setDeletingUser] = useState<User | null>(null);
    const pageSize = 10;

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const { data, isLoading } = useQuery(
        orpc.users.list.queryOptions({
            input: {
                q: debouncedSearch || undefined,
                role: roleFilter,
                status: statusFilter,
                limit: pageSize,
                offset: (page - 1) * pageSize,
            },
        }),
    );

    const invalidateUsers = () => {
        queryClient.invalidateQueries({ queryKey: orpc.users.list.key() });
    };

    const banMutation = useMutation({
        mutationFn: async (userId: string) => {
            await client.users.ban({ id: userId });
        },
        onSuccess: () => {
            sileo.success({ title: "User banned successfully" });
            invalidateUsers();
        },
        onError: (error: Error) => {
            sileo.error({ title: error.message });
        },
    });

    const unbanMutation = useMutation({
        mutationFn: async (userId: string) => {
            await client.users.unban({ id: userId });
        },
        onSuccess: () => {
            sileo.success({ title: "User unbanned successfully" });
            invalidateUsers();
        },
        onError: (error: Error) => {
            sileo.error({ title: error.message });
        },
    });

    const setRoleMutation = useMutation({
        mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
            await client.users.setRole({ id, role });
        },
        onSuccess: () => {
            sileo.success({ title: "User role updated successfully" });
            invalidateUsers();
        },
        onError: (error: Error) => {
            sileo.error({ title: error.message });
        },
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            await client.users.create({
                email: createForm.email.trim(),
                name: createForm.name.trim(),
                password: createForm.password,
                role: createForm.role,
            });
        },
        onSuccess: () => {
            sileo.success({ title: "User created successfully" });
            setCreateOpen(false);
            setCreateForm({ email: "", name: "", password: "", role: "user" });
            invalidateUsers();
        },
        onError: (error: Error) => {
            sileo.error({ title: error.message });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!editingUser) {
                throw new Error("No user selected");
            }

            await client.users.update({
                id: editingUser.id,
                banExpires:
                    editForm.status === "banned"
                        ? toIsoDateTime(editForm.banExpires)
                        : null,
                banReason:
                    editForm.status === "banned"
                        ? editForm.banReason.trim() || null
                        : null,
                banned: editForm.status === "banned",
                email: editForm.email.trim(),
                image: editForm.image.trim() || null,
                name: editForm.name.trim(),
                newPassword: editForm.newPassword || undefined,
                role: editForm.role,
            });
        },
        onSuccess: () => {
            sileo.success({ title: "User updated successfully" });
            setEditOpen(false);
            setEditingUser(null);
            setEditForm({
                banExpires: "",
                banReason: "",
                email: "",
                image: "",
                name: "",
                newPassword: "",
                role: "user",
                status: "active",
            });
            invalidateUsers();
        },
        onError: (error: Error) => {
            sileo.error({ title: error.message });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (userId: string) => {
            await client.users.delete({ id: userId });
        },
        onSuccess: () => {
            sileo.success({ title: "User deleted successfully" });
            setDeletingUser(null);
            invalidateUsers();
        },
        onError: (error: Error) => {
            sileo.error({ title: error.message });
        },
    });

    const openEditDialog = (user: User) => {
        setEditingUser(user);
        setEditForm({
            banExpires: toDateTimeLocal(user.banExpires),
            banReason: user.banReason || "",
            email: user.email,
            image: user.image || "",
            name: user.name,
            newPassword: "",
            role: getUserRole(user),
            status: user.banned ? "banned" : "active",
        });
        setEditOpen(true);
    };

    const users = (data?.items || []) as User[];
    const total = data?.total || 0;
    const totalPages = Math.ceil(total / pageSize);
    const createDisabled =
        !createForm.name.trim() ||
        !createForm.email.trim() ||
        createForm.password.length < 8 ||
        createMutation.isPending;
    const editDisabled =
        !editingUser ||
        !editForm.name.trim() ||
        !editForm.email.trim() ||
        (editForm.newPassword.length > 0 && editForm.newPassword.length < 8) ||
        updateMutation.isPending;

    return (
        <div className="mx-auto w-full max-w-6xl space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <h1 className="font-bold text-2xl tracking-tight">Users</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger render={<Button />}>
                            <FontAwesomeIcon
                                icon={faPlus}
                                className="mr-2 h-4 w-4"
                            />
                            Create User
                        </DialogTrigger>
                        <DialogPopup className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Create User</DialogTitle>
                                <DialogDescription>
                                    Create a new account with an initial
                                    password.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogPanel className="grid gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="create-name">Name</Label>
                                    <Input
                                        id="create-name"
                                        value={createForm.name}
                                        onChange={(event) =>
                                            setCreateForm((current) => ({
                                                ...current,
                                                name: event.target.value,
                                            }))
                                        }
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="create-email">Email</Label>
                                    <Input
                                        id="create-email"
                                        type="email"
                                        value={createForm.email}
                                        onChange={(event) =>
                                            setCreateForm((current) => ({
                                                ...current,
                                                email: event.target.value,
                                            }))
                                        }
                                        placeholder="john@example.com"
                                    />
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="create-password">
                                            Password
                                        </Label>
                                        <Input
                                            id="create-password"
                                            type="password"
                                            value={createForm.password}
                                            onChange={(event) =>
                                                setCreateForm((current) => ({
                                                    ...current,
                                                    password:
                                                        event.target.value,
                                                }))
                                            }
                                            placeholder="Min. 8 characters"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="create-role">
                                            Role
                                        </Label>
                                        <Select
                                            value={createForm.role}
                                            onValueChange={(value) =>
                                                setCreateForm((current) => ({
                                                    ...current,
                                                    role: value as UserRole,
                                                }))
                                            }
                                        >
                                            <SelectTrigger id="create-role">
                                                <SelectValue>
                                                    {
                                                        roleOptions.find(
                                                            (option) =>
                                                                option.value ===
                                                                createForm.role,
                                                        )?.label
                                                    }
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {roleOptions.map(
                                                    ({ label, value }) => (
                                                        <SelectItem
                                                            key={value}
                                                            value={value}
                                                        >
                                                            {label}
                                                        </SelectItem>
                                                    ),
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </DialogPanel>
                            <DialogFooter>
                                <DialogClose
                                    render={<Button variant="ghost" />}
                                >
                                    Cancel
                                </DialogClose>
                                <Button
                                    onClick={() => createMutation.mutate()}
                                    disabled={createDisabled}
                                >
                                    {createMutation.isPending && (
                                        <FontAwesomeIcon
                                            icon={faSpinner}
                                            className="mr-2 h-4 w-4 animate-spin"
                                        />
                                    )}
                                    Create User
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
                            placeholder="Search by name or email"
                            className="pl-8"
                            value={searchQuery}
                            onChange={(event) =>
                                setSearchQuery(event.target.value)
                            }
                        />
                    </div>
                    <Select
                        value={roleFilter}
                        onValueChange={(value) => {
                            setRoleFilter(value as "all" | "admin" | "user");
                            setPage(1);
                        }}
                    >
                        <SelectTrigger className="w-[130px]">
                            <SelectValue>
                                {
                                    roleFilterOptions.find(
                                        (option) => option.value === roleFilter,
                                    )?.label
                                }
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {roleFilterOptions.map(({ label, value }) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={statusFilter}
                        onValueChange={(value) => {
                            setStatusFilter(
                                value as "all" | "active" | "banned",
                            );
                            setPage(1);
                        }}
                    >
                        <SelectTrigger className="w-[130px]">
                            <SelectValue>
                                {
                                    statusFilterOptions.find(
                                        (option) =>
                                            option.value === statusFilter,
                                    )?.label
                                }
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {statusFilterOptions.map(({ label, value }) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="flex min-h-12 items-center gap-2 border-b bg-muted/20 px-4 py-3 font-medium text-muted-foreground text-sm">
                    <FontAwesomeIcon icon={faChevronDown} className="h-4 w-4" />
                    Users ({total})
                </div>
                <Table>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell
                                    colSpan={5}
                                    className="h-24 text-center"
                                >
                                    Loading...
                                </TableCell>
                            </TableRow>
                        ) : users.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={5}
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
                                            No users found
                                        </p>
                                        <p className="text-muted-foreground text-sm">
                                            {searchQuery ||
                                            roleFilter !== "all" ||
                                            statusFilter !== "all"
                                                ? "No users matching your search."
                                                : "No users registered yet."}
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            users.map((user) => (
                                <TableRow
                                    key={user.id}
                                    className="group h-[72px] hover:bg-muted/40"
                                >
                                    <TableCell className="w-[50px] pl-6">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage
                                                src={user.image || ""}
                                                alt={user.name}
                                            />
                                            <AvatarFallback>
                                                {getInitials(user)}
                                            </AvatarFallback>
                                        </Avatar>
                                    </TableCell>
                                    <TableCell>
                                        <div className="grid gap-1">
                                            <span className="flex flex-wrap items-center gap-2 font-semibold leading-none">
                                                {user.name}
                                                {user.role === "admin" && (
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-xs"
                                                    >
                                                        <FontAwesomeIcon
                                                            icon={
                                                                faShieldHalved
                                                            }
                                                            className="mr-1 h-3 w-3"
                                                        />
                                                        Admin
                                                    </Badge>
                                                )}
                                                {user.banned && (
                                                    <Badge
                                                        variant="destructive"
                                                        className="text-xs"
                                                    >
                                                        <FontAwesomeIcon
                                                            icon={faBan}
                                                            className="mr-1 h-3 w-3"
                                                        />
                                                        Banned
                                                    </Badge>
                                                )}
                                            </span>
                                            <span className="text-muted-foreground text-sm">
                                                {user.email}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        Joined{" "}
                                        {formatDistanceToNow(
                                            new Date(user.createdAt),
                                            {
                                                addSuffix: true,
                                            },
                                        )}
                                    </TableCell>
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
                                                    onClick={() =>
                                                        openEditDialog(user)
                                                    }
                                                >
                                                    <FontAwesomeIcon
                                                        icon={faPen}
                                                        className="mr-2 h-4 w-4"
                                                    />
                                                    Edit User
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                {user.role === "admin" ? (
                                                    <DropdownMenuItem
                                                        onClick={() =>
                                                            setRoleMutation.mutate(
                                                                {
                                                                    id: user.id,
                                                                    role: "user",
                                                                },
                                                            )
                                                        }
                                                    >
                                                        <FontAwesomeIcon
                                                            icon={
                                                                faShieldHalved
                                                            }
                                                            className="mr-2 h-4 w-4"
                                                        />
                                                        Remove Admin
                                                    </DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem
                                                        onClick={() =>
                                                            setRoleMutation.mutate(
                                                                {
                                                                    id: user.id,
                                                                    role: "admin",
                                                                },
                                                            )
                                                        }
                                                    >
                                                        <FontAwesomeIcon
                                                            icon={
                                                                faShieldHalved
                                                            }
                                                            className="mr-2 h-4 w-4"
                                                        />
                                                        Make Admin
                                                    </DropdownMenuItem>
                                                )}
                                                {user.banned ? (
                                                    <DropdownMenuItem
                                                        onClick={() =>
                                                            unbanMutation.mutate(
                                                                user.id,
                                                            )
                                                        }
                                                    >
                                                        <FontAwesomeIcon
                                                            icon={faUserXmark}
                                                            className="mr-2 h-4 w-4"
                                                        />
                                                        Unban User
                                                    </DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem
                                                        onClick={() =>
                                                            banMutation.mutate(
                                                                user.id,
                                                            )
                                                        }
                                                        className="text-red-500"
                                                    >
                                                        <FontAwesomeIcon
                                                            icon={faBan}
                                                            className="mr-2 h-4 w-4"
                                                        />
                                                        Ban User
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() =>
                                                        setDeletingUser(user)
                                                    }
                                                    className="text-red-500"
                                                >
                                                    <FontAwesomeIcon
                                                        icon={faTrash}
                                                        className="mr-2 h-4 w-4"
                                                    />
                                                    Delete User
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
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
                                                <PaginationItem
                                                    key={pageNumber}
                                                >
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
                                                onClick={() =>
                                                    setPage(pageNumber)
                                                }
                                                className="h-8 w-8"
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

            <Dialog
                open={editOpen}
                onOpenChange={(open) => {
                    setEditOpen(open);
                    if (!open) {
                        setEditingUser(null);
                    }
                }}
            >
                <DialogPopup className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>
                            Update profile details, access, status, or password.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogPanel className="grid gap-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="edit-name">Name</Label>
                                <Input
                                    id="edit-name"
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
                                <Label htmlFor="edit-email">Email</Label>
                                <Input
                                    id="edit-email"
                                    type="email"
                                    value={editForm.email}
                                    onChange={(event) =>
                                        setEditForm((current) => ({
                                            ...current,
                                            email: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-image">Image URL</Label>
                            <Input
                                id="edit-image"
                                value={editForm.image}
                                onChange={(event) =>
                                    setEditForm((current) => ({
                                        ...current,
                                        image: event.target.value,
                                    }))
                                }
                                placeholder="https://example.com/avatar.png"
                            />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="edit-role">Role</Label>
                                <Select
                                    value={editForm.role}
                                    onValueChange={(value) =>
                                        setEditForm((current) => ({
                                            ...current,
                                            role: value as UserRole,
                                        }))
                                    }
                                >
                                    <SelectTrigger id="edit-role">
                                        <SelectValue>
                                            {
                                                roleOptions.find(
                                                    (option) =>
                                                        option.value ===
                                                        editForm.role,
                                                )?.label
                                            }
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roleOptions.map(({ label, value }) => (
                                            <SelectItem
                                                key={value}
                                                value={value}
                                            >
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-status">Status</Label>
                                <Select
                                    value={editForm.status}
                                    onValueChange={(value) =>
                                        setEditForm((current) => ({
                                            ...current,
                                            status: value as UserStatus,
                                        }))
                                    }
                                >
                                    <SelectTrigger id="edit-status">
                                        <SelectValue>
                                            {
                                                statusOptions.find(
                                                    (option) =>
                                                        option.value ===
                                                        editForm.status,
                                                )?.label
                                            }
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {statusOptions.map(
                                            ({ label, value }) => (
                                                <SelectItem
                                                    key={value}
                                                    value={value}
                                                >
                                                    {label}
                                                </SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        {editForm.status === "banned" && (
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-ban-reason">
                                        Ban Reason
                                    </Label>
                                    <Input
                                        id="edit-ban-reason"
                                        value={editForm.banReason}
                                        onChange={(event) =>
                                            setEditForm((current) => ({
                                                ...current,
                                                banReason: event.target.value,
                                            }))
                                        }
                                        placeholder="Optional"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-ban-expires">
                                        Ban Expires
                                    </Label>
                                    <Input
                                        id="edit-ban-expires"
                                        type="datetime-local"
                                        value={editForm.banExpires}
                                        onChange={(event) =>
                                            setEditForm((current) => ({
                                                ...current,
                                                banExpires: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="edit-password">New Password</Label>
                            <Input
                                id="edit-password"
                                type="password"
                                value={editForm.newPassword}
                                onChange={(event) =>
                                    setEditForm((current) => ({
                                        ...current,
                                        newPassword: event.target.value,
                                    }))
                                }
                                placeholder="Leave blank to keep current password"
                            />
                        </div>
                    </DialogPanel>
                    <DialogFooter>
                        <DialogClose render={<Button variant="ghost" />}>
                            Cancel
                        </DialogClose>
                        <Button
                            onClick={() => updateMutation.mutate()}
                            disabled={editDisabled}
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
                open={!!deletingUser}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeletingUser(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete user?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete{" "}
                            <span className="font-semibold">
                                {deletingUser?.name}
                            </span>
                            . Their historical incident and status-page entries
                            will remain without an assigned user.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteMutation.isPending}>
                            Cancel
                        </AlertDialogCancel>
                        <Button
                            type="button"
                            onClick={() => {
                                if (deletingUser) {
                                    deleteMutation.mutate(deletingUser.id);
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
                            Delete User
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
