"use client";

import { Pencil, Trash, User } from "lucide-react";
import { useState } from "react";
import { sileo } from "sileo";
import { z } from "zod";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AvatarEditorProps {
	value?: string;
	onChange: (value: string) => void;
	name: string;
}

export function AvatarEditor({ value, onChange, name }: AvatarEditorProps) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [tempUrl, setTempUrl] = useState("");

	const handleOpenDialog = () => {
		setTempUrl(value || "");
		setDialogOpen(true);
	};

	const handleSave = () => {
		try {
			if (tempUrl) {
				z.string().url().parse(tempUrl);
			}
			onChange(tempUrl);
			setDialogOpen(false);
		} catch {
			sileo.error({ title: "Please enter a valid URL" });
		}
	};

	const handleRemove = () => {
		onChange("");
	};

	if (value) {
		return (
			<>
				<DropdownMenu>
					<DropdownMenuTrigger>
						<button
							type="button"
							className="relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border bg-muted transition-all hover:opacity-80"
						>
							<Avatar className="h-full w-full">
								<AvatarImage src={value} alt={name} className="object-cover" />
								<AvatarFallback>
									{name.slice(0, 2).toUpperCase()}
								</AvatarFallback>
							</Avatar>
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						<DropdownMenuItem onClick={handleOpenDialog}>
							<Pencil className="mr-2 h-4 w-4" />
							Change avatar
						</DropdownMenuItem>
						<DropdownMenuItem
							className="text-destructive focus:text-destructive"
							onClick={handleRemove}
						>
							<Trash className="mr-2 h-4 w-4" />
							Remove avatar
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>

				<AvatarDialog
					open={dialogOpen}
					onOpenChange={setDialogOpen}
					value={tempUrl}
					onChange={setTempUrl}
					onSave={handleSave}
				/>
			</>
		);
	}

	return (
		<>
			<button
				type="button"
				onClick={handleOpenDialog}
				className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-full border border-dashed bg-muted/50 transition-all hover:bg-muted hover:opacity-80"
			>
				<User className="h-8 w-8 text-muted-foreground" />
			</button>

			<AvatarDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				value={tempUrl}
				onChange={setTempUrl}
				onSave={handleSave}
			/>
		</>
	);
}

function AvatarDialog({
	open,
	onOpenChange,
	value,
	onChange,
	onSave,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	value: string;
	onChange: (value: string) => void;
	onSave: () => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Update Profile Picture</DialogTitle>
					<DialogDescription>
						Enter the URL of the image you want to use as your profile picture.
					</DialogDescription>
				</DialogHeader>
				<DialogPanel className="grid gap-4">
					<div className="grid gap-2">
						<Label htmlFor="url">Image URL</Label>
						<Input
							id="url"
							placeholder="https://example.com/avatar.png"
							value={value}
							onChange={(e) => onChange(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									onSave();
								}
							}}
						/>
					</div>
				</DialogPanel>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={onSave}>Save changes</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
