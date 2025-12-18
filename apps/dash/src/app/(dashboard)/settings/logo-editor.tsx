"use client";

import { ImageIcon, Pencil, Trash } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
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

interface LogoEditorProps {
	value?: string;
	onChange: (value: string) => void;
}

export function LogoEditor({ value, onChange }: LogoEditorProps) {
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
			toast.error("Please enter a valid URL");
		}
	};

	const handleRemove = () => {
		onChange("");
	};

	if (value) {
		return (
			<>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border bg-muted transition-all hover:opacity-80"
						>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src={value}
								alt="Organization logo"
								className="h-full w-full object-cover"
							/>
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						<DropdownMenuItem onClick={handleOpenDialog}>
							<Pencil className="mr-2 h-4 w-4" />
							Change logo
						</DropdownMenuItem>
						<DropdownMenuItem
							className="text-destructive focus:text-destructive"
							onClick={handleRemove}
						>
							<Trash className="mr-2 h-4 w-4" />
							Remove logo
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>

				<LogoDialog
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
				<ImageIcon className="h-8 w-8 text-muted-foreground" />
			</button>

			<LogoDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				value={tempUrl}
				onChange={setTempUrl}
				onSave={handleSave}
			/>
		</>
	);
}

function LogoDialog({
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
					<DialogTitle>Update Organization Logo</DialogTitle>
					<DialogDescription>
						Enter the URL of the image you want to use as your organization
						logo.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="url">Image URL</Label>
						<Input
							id="url"
							placeholder="https://example.com/logo.png"
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
				</div>
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
