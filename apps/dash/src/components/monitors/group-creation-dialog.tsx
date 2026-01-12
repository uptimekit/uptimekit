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
