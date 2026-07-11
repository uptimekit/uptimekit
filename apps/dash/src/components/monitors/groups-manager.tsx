"use client";

import {
    faEllipsis,
    faFolder,
    faPencil,
    faPlus,
    faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
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
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { client, orpc } from "@/utils/orpc";
import {
    buildGroupPaths,
    getGroupAndDescendantIds,
    NO_PARENT_LABEL,
    NONE_SELECT_VALUE,
    resolveGroupPathLabel,
} from "./group-tree";

interface GroupRecord {
    id: string;
    name: string;
    parentId?: string | null;
}

interface GroupsManagerProps {
    autoCreate?: boolean;
    readOnly?: boolean;
}

/**
 * Render a UI for viewing and managing monitor groups.
 *
 * Allows creating, renaming, and deleting groups via dialogs and confirmation flows,
 * and displays success/error toasts for those actions.
 *
 * @param autoCreate - If true, opens the Create Group dialog when the component mounts
 * @returns A React element that renders the groups management interface
 */
function useGroupsManagerModel({
    autoCreate = false,
    readOnly = false,
}: GroupsManagerProps) {
    const [createOpen, setCreateOpen] = useState(readOnly ? false : autoCreate);
    const [createName, setCreateName] = useState("");
    const [createParentId, setCreateParentId] = useState<string | null>(null);

    const [editOpen, setEditOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<GroupRecord | null>(null);
    const [editName, setEditName] = useState("");
    const [editParentId, setEditParentId] = useState<string | null>(null);

    const [deleteOpen, setDeleteOpen] = useState(false);
    const deletingGroupRef = useRef<GroupRecord | null>(null);

    const queryClient = useQueryClient();

    const { data: groups } = useQuery({
        ...orpc.monitors.listGroups.queryOptions(),
    });

    const groupPaths = buildGroupPaths(groups as GroupRecord[] | undefined);

    const { mutate: createGroup, isPending: isCreating } = useMutation({
        mutationFn: (input: { name: string; parentId: string | null }) =>
            client.monitors.createGroup(input),
        onSuccess: () => {
            sileo.success({ title: "Group created" });
            queryClient.invalidateQueries({
                queryKey: orpc.monitors.listGroups.key(),
            });
            setCreateOpen(false);
            setCreateName("");
            setCreateParentId(null);
        },
        onError: () => sileo.error({ title: "Failed to create group" }),
    });

    const { mutate: updateGroup, isPending: isUpdating } = useMutation({
        mutationFn: (input: {
            id: string;
            name: string;
            parentId: string | null;
        }) => client.monitors.updateGroup(input),
        onSuccess: () => {
            sileo.success({ title: "Group updated" });
            queryClient.invalidateQueries({
                queryKey: orpc.monitors.listGroups.key(),
            });
            queryClient.invalidateQueries({
                queryKey: orpc.monitors.list.key(),
            });
            setEditOpen(false);
            setEditingGroup(null);
            setEditName("");
            setEditParentId(null);
        },
        onError: () => sileo.error({ title: "Failed to update group" }),
    });

    const { mutate: deleteGroup, isPending: isDeleting } = useMutation({
        mutationFn: (id: string) => client.monitors.deleteGroup({ id }),
        onSuccess: () => {
            sileo.success({ title: "Group deleted" });
            queryClient.invalidateQueries({
                queryKey: orpc.monitors.listGroups.key(),
            });
            queryClient.invalidateQueries({
                queryKey: orpc.monitors.list.key(),
            });
            setDeleteOpen(false);
            deletingGroupRef.current = null;
        },
        onError: () => sileo.error({ title: "Failed to delete group" }),
    });

    const submitCreate = () => {
        const name = createName.trim();
        if (name) {
            createGroup({ name, parentId: createParentId });
        }
    };

    const submitEdit = () => {
        const name = editName.trim();
        if (name && editingGroup) {
            updateGroup({ id: editingGroup.id, name, parentId: editParentId });
        }
    };

    const openEdit = (group: GroupRecord) => {
        setEditingGroup(group);
        setEditName(group.name);
        setEditParentId(group.parentId ?? null);
        setEditOpen(true);
    };

    const openDelete = (group: GroupRecord) => {
        deletingGroupRef.current = group;
        setDeleteOpen(true);
    };

    const invalidParentIds = editingGroup
        ? getGroupAndDescendantIds(
              editingGroup.id,
              groups as GroupRecord[] | undefined,
          )
        : new Set<string>();

    const parentLabel = (value: string) =>
        resolveGroupPathLabel(value, groupPaths);

    return {
        autoCreate,
        readOnly,
        createOpen,
        setCreateOpen,
        createName,
        setCreateName,
        createParentId,
        setCreateParentId,
        editOpen,
        setEditOpen,
        editingGroup,
        setEditingGroup,
        editName,
        setEditName,
        editParentId,
        setEditParentId,
        deleteOpen,
        setDeleteOpen,
        deletingGroupRef,
        queryClient,
        groups,
        groupPaths,
        createGroup,
        isCreating,
        updateGroup,
        isUpdating,
        deleteGroup,
        isDeleting,
        submitCreate,
        submitEdit,
        openEdit,
        openDelete,
        invalidParentIds,
        parentLabel,
    };
}

type GroupsManagerModel = ReturnType<typeof useGroupsManagerModel>;

function GroupsManagerDialog1({ model }: { model: GroupsManagerModel }) {
    const {
        autoCreate,
        readOnly,
        createOpen,
        setCreateOpen,
        createName,
        setCreateName,
        createParentId,
        setCreateParentId,
        editOpen,
        setEditOpen,
        editingGroup,
        setEditingGroup,
        editName,
        setEditName,
        editParentId,
        setEditParentId,
        deleteOpen,
        setDeleteOpen,
        deletingGroupRef,
        queryClient,
        groups,
        groupPaths,
        createGroup,
        isCreating,
        updateGroup,
        isUpdating,
        deleteGroup,
        isDeleting,
        submitCreate,
        submitEdit,
        openEdit,
        openDelete,
        invalidParentIds,
        parentLabel,
    } = model;
    return (
        <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Groups</h3>
            {!readOnly && (
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger
                        render={<Button variant="outline" size="sm" />}
                    >
                        <FontAwesomeIcon
                            icon={faPlus}
                            className="mr-2 h-4 w-4"
                        />
                        New Group
                    </DialogTrigger>
                    <DialogPopup className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Create Group</DialogTitle>
                            <DialogDescription>
                                Create a new group to organize your monitors.
                                Nest it under another group to build a folder
                                structure.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogPanel>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="group-name">
                                        Group Name
                                    </Label>
                                    <Input
                                        id="group-name"
                                        placeholder="Production, Staging, etc."
                                        value={createName}
                                        onChange={(e) =>
                                            setCreateName(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                submitCreate();
                                            }
                                        }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="group-parent">
                                        Parent group
                                    </Label>
                                    <Select
                                        value={
                                            createParentId ?? NONE_SELECT_VALUE
                                        }
                                        onValueChange={(value) =>
                                            setCreateParentId(
                                                value === NONE_SELECT_VALUE
                                                    ? null
                                                    : value,
                                            )
                                        }
                                    >
                                        <SelectTrigger
                                            id="group-parent"
                                            className="w-full"
                                        >
                                            <SelectValue
                                                placeholder={NO_PARENT_LABEL}
                                            >
                                                {(value) =>
                                                    parentLabel(value as string)
                                                }
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem
                                                value={NONE_SELECT_VALUE}
                                            >
                                                {NO_PARENT_LABEL}
                                            </SelectItem>
                                            {groupPaths.map(
                                                ({ group, path, depth }) => (
                                                    <SelectItem
                                                        key={group.id}
                                                        value={group.id}
                                                    >
                                                        <span
                                                            style={{
                                                                paddingLeft:
                                                                    depth * 12,
                                                            }}
                                                        >
                                                            {path}
                                                        </span>
                                                    </SelectItem>
                                                ),
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </DialogPanel>
                        <DialogFooter>
                            <DialogClose render={<Button variant="ghost" />}>
                                Cancel
                            </DialogClose>
                            <Button
                                onClick={submitCreate}
                                disabled={!createName.trim() || isCreating}
                            >
                                Create
                            </Button>
                        </DialogFooter>
                    </DialogPopup>
                </Dialog>
            )}
        </div>
    );
}
function GroupsManagerView({ model }: { model: GroupsManagerModel }) {
    const {
        autoCreate,
        readOnly,
        createOpen,
        setCreateOpen,
        createName,
        setCreateName,
        createParentId,
        setCreateParentId,
        editOpen,
        setEditOpen,
        editingGroup,
        setEditingGroup,
        editName,
        setEditName,
        editParentId,
        setEditParentId,
        deleteOpen,
        setDeleteOpen,
        deletingGroupRef,
        queryClient,
        groups,
        groupPaths,
        createGroup,
        isCreating,
        updateGroup,
        isUpdating,
        deleteGroup,
        isDeleting,
        submitCreate,
        submitEdit,
        openEdit,
        openDelete,
        invalidParentIds,
        parentLabel,
    } = model;
    return (
        <div className="space-y-4">
            <GroupsManagerDialog1 model={model} />

            <div className="space-y-2">
                {groupPaths.map(({ group, depth }) => (
                    <div
                        key={group.id}
                        className="flex items-center justify-between rounded-md border bg-card p-3"
                        style={{ marginLeft: depth * 16 }}
                    >
                        <div className="flex items-center gap-2">
                            <FontAwesomeIcon
                                icon={faFolder}
                                className="h-4 w-4 text-muted-foreground"
                            />
                            <span className="font-medium text-sm">
                                {group.name}
                            </span>
                        </div>
                        {!readOnly && (
                            <DropdownMenu>
                                <DropdownMenuTrigger
                                    render={
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                        >
                                            <FontAwesomeIcon
                                                icon={faEllipsis}
                                                className="h-4 w-4"
                                            />
                                        </Button>
                                    }
                                />
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        onClick={() => openEdit(group)}
                                    >
                                        <FontAwesomeIcon
                                            icon={faPencil}
                                            className="mr-2 h-4 w-4"
                                        />
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="text-red-500"
                                        onClick={() => openDelete(group)}
                                    >
                                        <FontAwesomeIcon
                                            icon={faTrash}
                                            className="mr-2 h-4 w-4"
                                        />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                ))}
                {groupPaths.length === 0 && (
                    <p className="py-4 text-center text-muted-foreground text-sm">
                        {readOnly
                            ? "No groups have been created yet."
                            : "No groups yet. Create one to get started."}
                    </p>
                )}
            </div>

            {!readOnly && (
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogPopup className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Edit Group</DialogTitle>
                            <DialogDescription>
                                Update the group name or move it under another
                                group.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogPanel>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-group-name">
                                        Group Name
                                    </Label>
                                    <Input
                                        id="edit-group-name"
                                        value={editName}
                                        onChange={(e) =>
                                            setEditName(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                submitEdit();
                                            }
                                        }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-group-parent">
                                        Parent group
                                    </Label>
                                    <Select
                                        value={
                                            editParentId ?? NONE_SELECT_VALUE
                                        }
                                        onValueChange={(value) =>
                                            setEditParentId(
                                                value === NONE_SELECT_VALUE
                                                    ? null
                                                    : value,
                                            )
                                        }
                                    >
                                        <SelectTrigger
                                            id="edit-group-parent"
                                            className="w-full"
                                        >
                                            <SelectValue
                                                placeholder={NO_PARENT_LABEL}
                                            >
                                                {(value) =>
                                                    parentLabel(value as string)
                                                }
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem
                                                value={NONE_SELECT_VALUE}
                                            >
                                                {NO_PARENT_LABEL}
                                            </SelectItem>
                                            {groupPaths.flatMap(
                                                ({ group, path, depth }) =>
                                                    invalidParentIds.has(
                                                        group.id,
                                                    )
                                                        ? []
                                                        : [
                                                              <SelectItem
                                                                  key={group.id}
                                                                  value={
                                                                      group.id
                                                                  }
                                                              >
                                                                  <span
                                                                      style={{
                                                                          paddingLeft:
                                                                              depth *
                                                                              12,
                                                                      }}
                                                                  >
                                                                      {path}
                                                                  </span>
                                                              </SelectItem>,
                                                          ],
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </DialogPanel>
                        <DialogFooter>
                            <DialogClose render={<Button variant="ghost" />}>
                                Cancel
                            </DialogClose>
                            <Button
                                onClick={submitEdit}
                                disabled={!editName.trim() || isUpdating}
                            >
                                Update
                            </Button>
                        </DialogFooter>
                    </DialogPopup>
                </Dialog>
            )}

            {!readOnly && (
                <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Group</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete this group? Any
                                subgroups will move up to its parent, and
                                monitors in this group will not be deleted.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <Button
                                type="button"
                                className="bg-red-500 hover:bg-red-600"
                                disabled={isDeleting}
                                onClick={() => {
                                    if (deletingGroupRef.current) {
                                        deleteGroup(
                                            deletingGroupRef.current.id,
                                        );
                                    }
                                }}
                            >
                                Delete
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    );
}

export function GroupsManager({
    autoCreate = false,
    readOnly = false,
}: GroupsManagerProps) {
    const model = useGroupsManagerModel({ autoCreate, readOnly });
    return <GroupsManagerView model={model} />;
}
