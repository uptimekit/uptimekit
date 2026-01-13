"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Check,
	ChevronRight,
	Copy,
	Eye,
	EyeOff,
	Loader2,
	Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { REGIONS_BY_CONTINENT } from "@/lib/regions";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

/**
 * Render a dialog that lets the user create a worker and, on success, displays the worker's API key.
 *
 * The component shows a form for entering a worker name and selecting a region grouped by continent,
 * performs the create mutation, displays success/error toasts, invalidates the workers list on success,
 * and exposes the generated API key with copy or reveal controls. Closing the dialog after creation refreshes
 * the router and resets the dialog's local state.
 *
 * @returns The dialog React element for creating a worker and presenting the generated API key.
 */
export function CreateWorkerDialog() {
	const [open, setOpen] = useState(false);
	const [newWorkerKey, setNewWorkerKey] = useState<string | null>(null);
	const [isRevealed, setIsRevealed] = useState(false);
	const [isCopied, setIsCopied] = useState(false);
	const [openContinents, setOpenContinents] = useState<Record<string, boolean>>(
		{},
	);
	const router = useRouter();
	const queryClient = useQueryClient();

	// Check if we're on HTTPS (clipboard API is available)
	const isSecureContext =
		typeof window !== "undefined" &&
		(window.isSecureContext || window.location.protocol === "https:");

	const { mutate, isPending } = useMutation({
		...orpc.workers.create.mutationOptions(),
		onSuccess: (data) => {
			toast.success("Worker created successfully");
			setNewWorkerKey(data.key);
			queryClient.invalidateQueries({ queryKey: orpc.workers.list.key() });
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
			setIsCopied(true);
			toast.success("API Key copied to clipboard");
			setTimeout(() => setIsCopied(false), 2000);
		}
	};

	const toggleReveal = () => {
		setIsRevealed(!isRevealed);
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
				setIsCopied(false);
			}, 300);
		}
	};

	const toggleContinent = (continent: string) => {
		setOpenContinents((prev) => ({
			...prev,
			[continent]: !prev[continent],
		}));
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
							{isSecureContext ? (
								<Button size="sm" className="px-3" onClick={handleCopy}>
									<span className="sr-only">Copy</span>
									{isCopied ? (
										<Check className="h-4 w-4" />
									) : (
										<Copy className="h-4 w-4" />
									)}
								</Button>
							) : (
								<Button
									size="sm"
									variant="outline"
									className="px-3"
									onClick={toggleReveal}
								>
									<span className="sr-only">
										{isRevealed ? "Hide" : "Show"} API Key
									</span>
									{isRevealed ? (
										<EyeOff className="h-4 w-4" />
									) : (
										<Eye className="h-4 w-4" />
									)}
								</Button>
							)}
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
									<SelectContent className="max-h-[400px]">
										{REGIONS_BY_CONTINENT.map((group) => (
											<Collapsible
												key={group.continent}
												open={openContinents[group.continent]}
												onOpenChange={() => toggleContinent(group.continent)}
											>
												<CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1.5 font-semibold text-muted-foreground text-sm hover:bg-accent hover:text-accent-foreground">
													<span>{group.continent}</span>
													<ChevronRight
														className={cn(
															"h-4 w-4 transition-transform duration-200",
															openContinents[group.continent] && "rotate-90",
														)}
													/>
												</CollapsibleTrigger>
												<CollapsibleContent>
													{group.regions.map((region) => (
														<SelectItem key={region.value} value={region.value}>
															<div className="flex items-center gap-2">
																<region.Flag className="h-4 w-5 rounded-sm object-cover" />
																<span>{region.label}</span>
															</div>
														</SelectItem>
													))}
												</CollapsibleContent>
											</Collapsible>
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