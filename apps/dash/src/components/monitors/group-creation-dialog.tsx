"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogPanel,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { client, orpc } from "@/utils/orpc";

interface GroupCreationDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated?: () => void;
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
	onCreated,
}: GroupCreationDialogProps) {
	const [groupName, setGroupName] = useState("");

	const queryClient = useQueryClient();

	const { mutate: createGroup, isPending: isCreating } = useMutation({
		mutationFn: (name: string) => client.monitors.createGroup({ name }),
		onSuccess: () => {
			toast.success("Group created");
			queryClient.invalidateQueries({
				queryKey: orpc.monitors.listGroups.key(),
			});
			onOpenChange(false);
			setGroupName("");
			onCreated?.();
		},
		onError: () => toast.error("Failed to create group"),
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create Group</DialogTitle>
					<DialogDescription>
						Create a new group to organize your monitors.
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
								if (e.key === "Enter" && groupName.trim()) {
									createGroup(groupName.trim());
								}
							}}
						/>
					</div>
				</DialogPanel>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => {
							onOpenChange(false);
							setGroupName("");
						}}
					>
						Cancel
					</Button>
					<Button
						onClick={() => groupName.trim() && createGroup(groupName.trim())}
						disabled={!groupName.trim() || isCreating}
					>
						Create
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
