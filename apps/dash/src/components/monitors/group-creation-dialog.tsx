"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { sileo } from "sileo";
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
} from "@/components/ui/dialog";
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
    NO_PARENT_LABEL,
    NONE_SELECT_VALUE,
    resolveGroupPathLabel,
} from "./group-tree";

type CreatedGroup = Awaited<ReturnType<typeof client.monitors.createGroup>>;

interface GroupCreationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultParentId?: string | null;
    onCreated?: (group: CreatedGroup) => void;
}

/**
 * Renders a dialog UI that lets the user create a new monitor group.
 *
 * The dialog contains an input for the group name and actions to cancel or create.
 * Submitting (Enter or Create) with a non-empty name triggers a creation request,
 * shows a success or error toast, refreshes the group list on success, closes the dialog,
 * clears the input, and calls `onCreated` if provided.
 *
 * @param onCreated - Optional callback invoked after a group is successfully created
 * @returns The dialog React element for creating a monitor group
 */
export function GroupCreationDialog({
    open,
    onOpenChange,
    defaultParentId,
    onCreated,
}: GroupCreationDialogProps) {
    const [groupName, setGroupName] = useState("");
    const [parentId, setParentId] = useState<string | null>(
        defaultParentId ?? null,
    );

    const queryClient = useQueryClient();

    const { data: groups } = useQuery({
        ...orpc.monitors.listGroups.queryOptions(),
    });

    const groupOptions = buildGroupPaths(groups);

    const { mutate: createGroup, isPending: isCreating } = useMutation({
        mutationFn: (input: { name: string; parentId: string | null }) =>
            client.monitors.createGroup(input),
        onSuccess: (group) => {
            sileo.success({ title: "Group created" });
            queryClient.invalidateQueries({
                queryKey: orpc.monitors.listGroups.key(),
            });
            onOpenChange(false);
            setGroupName("");
            setParentId(null);
            if (group) {
                onCreated?.(group);
            }
        },
        onError: () => sileo.error({ title: "Failed to create group" }),
    });

    const submit = () => {
        const name = groupName.trim();
        if (name) {
            createGroup({ name, parentId });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogPopup className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create Group</DialogTitle>
                    <DialogDescription>
                        Create a new group to organize your monitors. Nest it
                        under another group to build a folder structure.
                    </DialogDescription>
                </DialogHeader>
                <DialogPanel className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="group-name">Group Name</Label>
                        <Input
                            id="group-name"
                            placeholder="Production, Staging, etc."
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    submit();
                                }
                            }}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="group-parent">Parent group</Label>
                        <Select
                            value={parentId ?? NONE_SELECT_VALUE}
                            onValueChange={(value) =>
                                setParentId(
                                    value === NONE_SELECT_VALUE ? null : value,
                                )
                            }
                        >
                            <SelectTrigger id="group-parent" className="w-full">
                                <SelectValue placeholder={NO_PARENT_LABEL}>
                                    {(value) =>
                                        resolveGroupPathLabel(
                                            value as string,
                                            groupOptions,
                                        )
                                    }
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE_SELECT_VALUE}>
                                    {NO_PARENT_LABEL}
                                </SelectItem>
                                {groupOptions.map(({ group, path, depth }) => (
                                    <SelectItem key={group.id} value={group.id}>
                                        <span
                                            style={{ paddingLeft: depth * 12 }}
                                        >
                                            {path}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </DialogPanel>
                <DialogFooter>
                    <DialogClose render={<Button variant="ghost" />}>
                        Cancel
                    </DialogClose>
                    <Button
                        onClick={submit}
                        disabled={!groupName.trim() || isCreating}
                    >
                        Create
                    </Button>
                </DialogFooter>
            </DialogPopup>
        </Dialog>
    );
}
