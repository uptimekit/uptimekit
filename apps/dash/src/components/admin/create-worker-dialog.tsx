"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Check,
	ChevronsUpDown,
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
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
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
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ALL_REGIONS, REGIONS_BY_CONTINENT } from "@/lib/regions";
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
	const [locationPopoverOpen, setLocationPopoverOpen] = useState(false);
	const [selectedLocation, setSelectedLocation] = useState("");
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
				setLocationPopoverOpen(false);
				setSelectedLocation("");
			}, 300);
		}
	};

	const selectedRegion = ALL_REGIONS.find(
		(region) => region.value === selectedLocation,
	);

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
								<input
									id="location"
									name="location"
									value={selectedLocation}
									required
									readOnly
									className="sr-only"
									tabIndex={-1}
								/>
								<Popover
									open={locationPopoverOpen}
									onOpenChange={setLocationPopoverOpen}
								>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											role="combobox"
											aria-expanded={locationPopoverOpen}
											className={cn(
												"w-full justify-between",
												!selectedRegion && "text-muted-foreground",
											)}
										>
											{selectedRegion ? (
												<div className="flex items-center gap-2">
													<selectedRegion.Flag className="h-4 w-5 rounded-sm object-cover" />
													<span>{selectedRegion.label}</span>
												</div>
											) : (
												"Select a region"
											)}
											<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
										<Command>
											<CommandInput placeholder="Search regions..." />
											<CommandList className="max-h-[400px]">
												<CommandEmpty>No region found.</CommandEmpty>
												{REGIONS_BY_CONTINENT.map((group) => (
													<CommandGroup
														key={group.continent}
														heading={group.continent}
													>
														{group.regions.map((region) => (
															<CommandItem
																key={region.value}
																value={`${region.label} ${group.continent}`}
																onSelect={() => {
																	setSelectedLocation(region.value);
																	setLocationPopoverOpen(false);
																}}
															>
																<div className="flex items-center gap-2">
																	<region.Flag className="h-4 w-5 rounded-sm object-cover" />
																	<span>{region.label}</span>
																</div>
																<Check
																	className={cn(
																		"ml-auto h-4 w-4",
																		selectedLocation === region.value
																			? "opacity-100"
																			: "opacity-0",
																	)}
																/>
															</CommandItem>
														))}
													</CommandGroup>
												))}
											</CommandList>
										</Command>
									</PopoverContent>
								</Popover>
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
