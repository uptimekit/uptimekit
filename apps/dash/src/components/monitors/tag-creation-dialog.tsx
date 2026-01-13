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

const PRESET_COLORS = [
	"#3b82f6", // blue
	"#10b981", // green
	"#f59e0b", // amber
	"#ef4444", // red
	"#8b5cf6", // purple
	"#ec4899", // pink
	"#06b6d4", // cyan
	"#84cc16", // lime
];

interface TagCreationDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated?: () => void;
}

/**
 * Render a dialog UI for creating a new tag with a name and color.
 *
 * The dialog lets users enter a tag name, pick a color from preset swatches, and submit to create the tag.
 * On successful creation it shows a success toast, invalidates the tags query, closes the dialog, resets inputs,
 * and calls `onCreated` if provided. On failure it shows an error toast.
 *
 * @param open - Whether the dialog is visible
 * @param onOpenChange - Callback to update the dialog open state
 * @param onCreated - Optional callback invoked after a tag is successfully created
 * @returns A JSX element containing the tag creation dialog
 */
export function TagCreationDialog({
	open,
	onOpenChange,
	onCreated,
}: TagCreationDialogProps) {
	const [tagName, setTagName] = useState("");
	const [tagColor, setTagColor] = useState(PRESET_COLORS[0]);

	const queryClient = useQueryClient();

	const { mutate: createTag, isPending: isCreating } = useMutation({
		mutationFn: ({ name, color }: { name: string; color: string }) =>
			client.monitors.createTag({ name, color }),
		onSuccess: () => {
			toast.success("Tag created");
			queryClient.invalidateQueries({ queryKey: orpc.monitors.listTags.key() });
			onOpenChange(false);
			setTagName("");
			setTagColor(PRESET_COLORS[0]);
			onCreated?.();
		},
		onError: () => toast.error("Failed to create tag"),
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create Tag</DialogTitle>
					<DialogDescription>
						Create a new tag to categorize your monitors.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="tag-name">Tag Name</Label>
						<Input
							id="tag-name"
							placeholder="Critical, API, Frontend, etc."
							value={tagName}
							onChange={(e) => setTagName(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && tagName.trim()) {
									createTag({ name: tagName.trim(), color: tagColor });
								}
							}}
						/>
					</div>
					<div className="space-y-2">
						<Label>Color</Label>
						<div className="flex gap-2">
							{PRESET_COLORS.map((color) => (
								<button
									key={color}
									type="button"
									className="h-8 w-8 rounded-md border-2 transition-all hover:scale-110"
									style={{
										backgroundColor: color,
										borderColor: tagColor === color ? "#000" : "transparent",
									}}
									onClick={() => setTagColor(color)}
								/>
							))}
						</div>
					</div>
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => {
							onOpenChange(false);
							setTagName("");
							setTagColor(PRESET_COLORS[0]);
						}}
					>
						Cancel
					</Button>
					<Button
						onClick={() =>
							tagName.trim() &&
							createTag({ name: tagName.trim(), color: tagColor })
						}
						disabled={!tagName.trim() || isCreating}
					>
						Create
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}