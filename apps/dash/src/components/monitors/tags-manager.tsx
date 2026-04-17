"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
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

interface TagsManagerProps {
	autoCreate?: boolean;
}

/**
 * Render a UI for listing, creating, editing, and deleting monitor tags.
 *
 * The component displays existing tags, provides dialogs to create or edit a tag
 * (including selecting a color from a preset palette), and exposes per-tag actions
 * for editing or deleting with confirmation. Mutations refresh the tag list and
 * show success or error toasts.
 *
 * @param autoCreate - If `true`, opens the create-tag dialog when the component mounts.
 * @returns The rendered TagsManager React element.
 */
export function TagsManager({ autoCreate = false }: TagsManagerProps) {
	const [createOpen, setCreateOpen] = useState(autoCreate);
	const [editOpen, setEditOpen] = useState(false);
	const [editingTag, setEditingTag] = useState<{
		id: string;
		name: string;
		color: string;
	} | null>(null);
	const [tagName, setTagName] = useState("");
	const [tagColor, setTagColor] = useState(PRESET_COLORS[0]);

	const queryClient = useQueryClient();

	const { data: tags } = useQuery({
		...orpc.monitors.listTags.queryOptions(),
	});

	const { mutate: createTag, isPending: isCreating } = useMutation({
		mutationFn: ({ name, color }: { name: string; color: string }) =>
			client.monitors.createTag({ name, color }),
		onSuccess: () => {
			sileo.success({ title: "Tag created" });
			queryClient.invalidateQueries({ queryKey: orpc.monitors.listTags.key() });
			setCreateOpen(false);
			setTagName("");
			setTagColor(PRESET_COLORS[0]);
		},
		onError: () => sileo.error({ title: "Failed to create tag" }),
	});

	const { mutate: updateTag, isPending: isUpdating } = useMutation({
		mutationFn: ({
			id,
			name,
			color,
		}: {
			id: string;
			name?: string;
			color?: string;
		}) => client.monitors.updateTag({ id, name, color }),
		onSuccess: () => {
			sileo.success({ title: "Tag updated" });
			queryClient.invalidateQueries({ queryKey: orpc.monitors.listTags.key() });
			queryClient.invalidateQueries({ queryKey: orpc.monitors.list.key() });
			setEditOpen(false);
			setEditingTag(null);
			setTagName("");
			setTagColor(PRESET_COLORS[0]);
		},
		onError: () => sileo.error({ title: "Failed to update tag" }),
	});

	const { mutate: deleteTag } = useMutation({
		mutationFn: (id: string) => client.monitors.deleteTag({ id }),
		onSuccess: () => {
			sileo.success({ title: "Tag deleted" });
			queryClient.invalidateQueries({ queryKey: orpc.monitors.listTags.key() });
			queryClient.invalidateQueries({ queryKey: orpc.monitors.list.key() });
		},
		onError: () => sileo.error({ title: "Failed to delete tag" }),
	});

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="font-semibold text-sm">Tags</h3>
				<Dialog open={createOpen} onOpenChange={setCreateOpen}>
					<DialogTrigger render={<Button variant="outline" size="sm" />}>
						<Plus className="mr-2 h-4 w-4" />
						New Tag
					</DialogTrigger>
					<DialogPopup className="sm:max-w-[425px]">
						<DialogHeader>
							<DialogTitle>Create Tag</DialogTitle>
							<DialogDescription>
								Create a new tag to categorize your monitors.
							</DialogDescription>
						</DialogHeader>
						<DialogPanel>
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
													borderColor:
														tagColor === color ? "#000" : "transparent",
												}}
												onClick={() => setTagColor(color)}
											/>
										))}
									</div>
								</div>
							</div>
						</DialogPanel>
						<DialogFooter>
							<DialogClose render={<Button variant="ghost" />}>
								Cancel
							</DialogClose>
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
					</DialogPopup>
				</Dialog>
			</div>

			<div className="flex flex-wrap gap-2">
				{tags?.map((tag) => (
					<div
						key={tag.id}
						className="flex items-center gap-1 rounded-md border bg-card px-2 py-1"
					>
						<div
							className="h-3 w-3 rounded-full"
							style={{ backgroundColor: tag.color }}
						/>
						<span className="font-medium text-sm">{tag.name}</span>
						<DropdownMenu modal={false}>
							<DropdownMenuTrigger
								render={
									<Button
										variant="ghost"
										size="icon"
										className="h-5 w-5 text-muted-foreground hover:text-foreground"
									>
										<MoreHorizontal className="h-3 w-3" />
									</Button>
								}
							/>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onSelect={(e) => {
										e.preventDefault();
										setEditingTag(tag);
										setTagName(tag.name);
										setTagColor(tag.color);
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
											<AlertDialogTitle>Delete Tag</AlertDialogTitle>
											<AlertDialogDescription>
												Are you sure you want to delete this tag? It will be
												removed from all monitors.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>Cancel</AlertDialogCancel>
											<Button
												type="button"
												className="bg-red-500 hover:bg-red-600"
												onClick={() => deleteTag(tag.id)}
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
				{(!tags || tags.length === 0) && (
					<p className="w-full py-4 text-center text-muted-foreground text-sm">
						No tags yet. Create one to get started.
					</p>
				)}
			</div>

			<Dialog open={editOpen} onOpenChange={setEditOpen}>
				<DialogPopup className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>Edit Tag</DialogTitle>
						<DialogDescription>Update the tag name or color.</DialogDescription>
					</DialogHeader>
					<DialogPanel>
						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="edit-tag-name">Tag Name</Label>
								<Input
									id="edit-tag-name"
									value={tagName}
									onChange={(e) => setTagName(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && tagName.trim() && editingTag) {
											updateTag({
												id: editingTag.id,
												name: tagName.trim(),
												color: tagColor,
											});
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
												borderColor:
													tagColor === color ? "#000" : "transparent",
											}}
											onClick={() => setTagColor(color)}
										/>
									))}
								</div>
							</div>
						</div>
					</DialogPanel>
					<DialogFooter>
						<DialogClose render={<Button variant="ghost" />}>
							Cancel
						</DialogClose>
						<Button
							onClick={() =>
								editingTag &&
								tagName.trim() &&
								updateTag({
									id: editingTag.id,
									name: tagName.trim(),
									color: tagColor,
								})
							}
							disabled={!tagName.trim() || isUpdating}
						>
							Update
						</Button>
					</DialogFooter>
				</DialogPopup>
			</Dialog>
		</div>
	);
}
