"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Folder, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { sileo } from "sileo";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
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
import { client, orpc } from "@/utils/orpc";

interface GroupsManagerProps {
	autoCreate?: boolean;
}

/**
 * Render a UI for viewing and managing monitor groups.
 *
 * Allows creating, renaming, and deleting groups via dialogs and confirmation flows, and displays success/error toasts for those actions.
 *
 * @param autoCreate - If true, opens the Create Group dialog when the component mounts
 * @returns A React element that renders the groups management interface
 */
export function GroupsManager({ autoCreate = false }: GroupsManagerProps) {
	const [createOpen, setCreateOpen] = useState(autoCreate);
	const [editOpen, setEditOpen] = useState(false);
	const [editingGroup, setEditingGroup] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const [groupName, setGroupName] = useState("");

	const queryClient = useQueryClient();

	const { data: groups } = useQuery({
		...orpc.monitors.listGroups.queryOptions(),
	});

	const { mutate: createGroup, isPending: isCreating } = useMutation({
		mutationFn: (name: string) => client.monitors.createGroup({ name }),
		onSuccess: () => {
			sileo.success({ title: "Group created" });
			queryClient.invalidateQueries({
				queryKey: orpc.monitors.listGroups.key(),
			});
			setCreateOpen(false);
			setGroupName("");
		},
		onError: () => sileo.error({ title: "Failed to create group" }),
	});

	const { mutate: updateGroup, isPending: isUpdating } = useMutation({
		mutationFn: ({ id, name }: { id: string; name: string }) =>
			client.monitors.updateGroup({ id, name }),
		onSuccess: () => {
			sileo.success({ title: "Group updated" });
			queryClient.invalidateQueries({
				queryKey: orpc.monitors.listGroups.key(),
			});
			queryClient.invalidateQueries({ queryKey: orpc.monitors.list.key() });
			setEditOpen(false);
			setEditingGroup(null);
			setGroupName("");
		},
		onError: () => sileo.error({ title: "Failed to update group" }),
	});

	const { mutate: deleteGroup } = useMutation({
		mutationFn: (id: string) => client.monitors.deleteGroup({ id }),
		onSuccess: () => {
			sileo.success({ title: "Group deleted" });
			queryClient.invalidateQueries({
				queryKey: orpc.monitors.listGroups.key(),
			});
			queryClient.invalidateQueries({ queryKey: orpc.monitors.list.key() });
		},
		onError: () => sileo.error({ title: "Failed to delete group" }),
	});

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="font-semibold text-sm">Groups</h3>
				<Dialog open={createOpen} onOpenChange={setCreateOpen}>
					<DialogTrigger render={<Button variant="outline" size="sm" />}>
						<Plus className="mr-2 h-4 w-4" />
						New Group
					</DialogTrigger>
					<DialogPopup className="sm:max-w-[425px]">
						<DialogHeader>
							<DialogTitle>Create Group</DialogTitle>
							<DialogDescription>
								Create a new group to organize your monitors.
							</DialogDescription>
						</DialogHeader>
						<DialogPanel>
							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="group-name">Group Name</Label>
									<Input
										id="group-name"
										placeholder="Production, Staging, etc."
										value={groupName}
										onChange={(e) => setGroupName(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter" && groupName.trim()) {
												createGroup(groupName.trim());
											}
										}}
									/>
								</div>
							</div>
						</DialogPanel>
						<DialogFooter>
							<DialogClose render={<Button variant="ghost" />}>
								Cancel
							</DialogClose>
							<Button
								onClick={() =>
									groupName.trim() && createGroup(groupName.trim())
								}
								disabled={!groupName.trim() || isCreating}
							>
								Create
							</Button>
						</DialogFooter>
					</DialogPopup>
				</Dialog>
			</div>

			<div className="space-y-2">
				{groups?.map((group) => (
					<div
						key={group.id}
						className="flex items-center justify-between rounded-md border bg-card p-3"
					>
						<div className="flex items-center gap-2">
							<Folder className="h-4 w-4 text-muted-foreground" />
							<span className="font-medium text-sm">{group.name}</span>
						</div>
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<Button variant="ghost" size="icon" className="h-8 w-8">
										<MoreHorizontal className="h-4 w-4" />
									</Button>
								}
							/>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onClick={() => {
										setEditingGroup(group);
										setGroupName(group.name);
										setEditOpen(true);
									}}
								>
									<Pencil className="mr-2 h-4 w-4" />
									Edit
								</DropdownMenuItem>
								<AlertDialog>
									<AlertDialogTrigger
										render={
											<DropdownMenuItem
												className="text-red-500"
												onSelect={(e) => e.preventDefault()}
											/>
										}
									>
										<Trash2 className="mr-2 h-4 w-4" />
										Delete
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>Delete Group</AlertDialogTitle>
											<AlertDialogDescription>
												Are you sure you want to delete this group? Monitors in
												this group will not be deleted.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>Cancel</AlertDialogCancel>
											<Button
												type="button"
												className="bg-red-500 hover:bg-red-600"
												onClick={() => deleteGroup(group.id)}
											>
												Delete
											</Button>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				))}
				{(!groups || groups.length === 0) && (
					<p className="py-4 text-center text-muted-foreground text-sm">
						No groups yet. Create one to get started.
					</p>
				)}
			</div>

			<Dialog open={editOpen} onOpenChange={setEditOpen}>
				<DialogPopup className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>Edit Group</DialogTitle>
						<DialogDescription>Update the group name.</DialogDescription>
					</DialogHeader>
					<DialogPanel>
						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="edit-group-name">Group Name</Label>
								<Input
									id="edit-group-name"
									value={groupName}
									onChange={(e) => setGroupName(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && groupName.trim() && editingGroup) {
											updateGroup({
												id: editingGroup.id,
												name: groupName.trim(),
											});
										}
									}}
								/>
							</div>
						</div>
					</DialogPanel>
					<DialogFooter>
						<DialogClose render={<Button variant="ghost" />}>
							Cancel
						</DialogClose>
						<Button
							onClick={() =>
								editingGroup &&
								groupName.trim() &&
								updateGroup({ id: editingGroup.id, name: groupName.trim() })
							}
							disabled={!groupName.trim() || isUpdating}
						>
							Update
						</Button>
					</DialogFooter>
				</DialogPopup>
			</Dialog>
		</div>
	);
}
