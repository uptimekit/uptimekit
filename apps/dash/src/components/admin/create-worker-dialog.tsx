"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, Copy, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
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
	DialogTrigger,
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
import { WORKER_REGIONS } from "@/lib/regions";
import { orpc } from "@/utils/orpc";

export function CreateWorkerDialog() {
	const [open, setOpen] = useState(false);
	const [newWorkerKey, setNewWorkerKey] = useState<string | null>(null);
	const [isRevealed, setIsRevealed] = useState(false);
	const router = useRouter();

	const { mutate, isPending } = useMutation({
		...orpc.workers.create.mutationOptions(),
		onSuccess: (data) => {
			toast.success("Worker created successfully");
			setNewWorkerKey(data.key);
		},
		onError: (error: Error) => {
			toast.error(error.message);
		},
	});

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const name = formData.get("name") as string;
		const location = formData.get("location") as string;

		mutate({ name, location });
	};

	const handleCopy = () => {
		if (newWorkerKey) {
			navigator.clipboard.writeText(newWorkerKey);
			setIsRevealed(true);
			toast.success("API Key copied to clipboard");
		}
	};

	const handleOpenChange = (isOpen: boolean) => {
		setOpen(isOpen);
		if (!isOpen) {
			if (newWorkerKey) {
				router.refresh();
			}
			// Reset state after a short delay to allow animation to finish
			setTimeout(() => {
				setNewWorkerKey(null);
				setIsRevealed(false);
			}, 300);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button size="sm" className="h-8 gap-1">
					<Plus className="h-3.5 w-3.5" />
					<span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
						Add Worker
					</span>
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>
						{newWorkerKey ? "Worker Created" : "Create Worker"}
					</DialogTitle>
					<DialogDescription>
						{newWorkerKey
							? "Copy the API key below. You won't be able to see it again."
							: "Add a new worker to your monitoring fleet."}
					</DialogDescription>
				</DialogHeader>

				{newWorkerKey ? (
					<div className="py-4">
						<div className="flex items-center space-x-2">
							<div className="grid flex-1 gap-2">
								<Label htmlFor="link" className="sr-only">
									API Key
								</Label>
								<Input
									id="link"
									value={newWorkerKey}
									readOnly
									type={isRevealed ? "text" : "password"}
								/>
							</div>
							<Button size="sm" className="px-3" onClick={handleCopy}>
								<span className="sr-only">Copy</span>
								{isRevealed ? (
									<Check className="h-4 w-4" />
								) : (
									<Copy className="h-4 w-4" />
								)}
							</Button>
						</div>
					</div>
				) : (
					<form onSubmit={handleSubmit}>
						<div className="grid gap-4 py-4">
							<div className="grid gap-2">
								<Label htmlFor="name">Name</Label>
								<Input id="name" name="name" placeholder="My Worker" required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="location">Location</Label>
								<Select name="location" required>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Select a region" />
									</SelectTrigger>
									<SelectContent>
										{WORKER_REGIONS.map((region) => (
											<SelectItem key={region.value} value={region.value}>
												<div className="flex items-center gap-2">
													<region.Flag className="h-4 w-5 rounded-sm object-cover" />
													<span>{region.label}</span>
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
						<DialogFooter>
							<Button type="submit" disabled={isPending}>
								{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								Create Worker
							</Button>
						</DialogFooter>
					</form>
				)}
				{newWorkerKey && (
					<DialogFooter>
						<Button type="button" onClick={() => handleOpenChange(false)}>
							Done
						</Button>
					</DialogFooter>
				)}
			</DialogContent>
		</Dialog>
	);
}
