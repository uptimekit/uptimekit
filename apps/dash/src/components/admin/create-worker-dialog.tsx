"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Copy, Eye, EyeOff, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Combobox,
	ComboboxEmpty,
	ComboboxGroup,
	ComboboxGroupLabel,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	ComboboxPopup,
	ComboboxValue,
} from "@/components/ui/combobox";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	ALL_REGIONS,
	REGIONS_BY_CONTINENT,
	type RegionInfo,
} from "@/lib/regions";
import { orpc } from "@/utils/orpc";

// Flatten regions with group info for virtualization
interface FlattenedRegion {
	region: RegionInfo;
	continent: string;
	isFirstInGroup: boolean;
}

const FLATTENED_REGIONS: FlattenedRegion[] = REGIONS_BY_CONTINENT.flatMap(
	(group) =>
		group.regions.map((region, index) => ({
			region,
			continent: group.continent,
			isFirstInGroup: index === 0,
		})),
);

// Estimate height for virtualization
const ITEM_HEIGHT = 32; // px
const GROUP_LABEL_HEIGHT = 24; // px

function VirtualizedRegionList({
	parentRef,
}: {
	parentRef: React.RefObject<HTMLDivElement | null>;
}) {
	const virtualizer = useVirtualizer({
		count: FLATTENED_REGIONS.length,
		getScrollElement: () => parentRef.current,
		estimateSize: (index) => {
			return FLATTENED_REGIONS[index]?.isFirstInGroup
				? ITEM_HEIGHT + GROUP_LABEL_HEIGHT
				: ITEM_HEIGHT;
		},
		overscan: 5,
	});

	const virtualItems = virtualizer.getVirtualItems();

	return (
		<div
			style={{
				height: `${virtualizer.getTotalSize()}px`,
				width: "100%",
				position: "relative",
			}}
		>
			{virtualItems.map((virtualItem) => {
				const item = FLATTENED_REGIONS[virtualItem.index];
				if (!item) return null;

				return (
					<div
						key={item.region.value}
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							width: "100%",
							transform: `translateY(${virtualItem.start}px)`,
						}}
					>
						{item.isFirstInGroup && (
							<ComboboxGroupLabel>{item.continent}</ComboboxGroupLabel>
						)}
						<ComboboxItem value={item.region}>
							<div className="flex items-center gap-2">
								<item.region.Flag className="h-4 w-5 rounded-sm object-cover" />
								<span>{item.region.label}</span>
							</div>
						</ComboboxItem>
					</div>
				);
			})}
		</div>
	);
}

export function CreateWorkerDialog() {
	const [open, setOpen] = useState(false);
	const [newWorkerKey, setNewWorkerKey] = useState<string | null>(null);
	const [isRevealed, setIsRevealed] = useState(false);
	const [isCopied, setIsCopied] = useState(false);
	const [selectedLocation, setSelectedLocation] = useState("");
	const [newWorkerName, setNewWorkerName] = useState("");
	const comboboxListRef = useRef<HTMLDivElement>(null);

	const router = useRouter();
	const queryClient = useQueryClient();

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

	const resetState = () => {
		setNewWorkerKey(null);
		setIsRevealed(false);
		setIsCopied(false);
		setSelectedLocation("");
		setNewWorkerName("");
	};

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		const name = newWorkerName.trim();
		const location = selectedLocation;

		if (!name) {
			toast.error("Name is required");
			return;
		}

		if (!location) {
			toast.error("Location is required");
			return;
		}

		mutate({ name, location });
	};

	const handleCopy = async () => {
		if (!newWorkerKey) return;

		try {
			await navigator.clipboard.writeText(newWorkerKey);
			setIsCopied(true);
			toast.success("API key copied to clipboard");
			setTimeout(() => setIsCopied(false), 2000);
		} catch {
			toast.error("Failed to copy API key");
		}
	};

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen);

		if (!nextOpen) {
			if (newWorkerKey) {
				router.refresh();
			}
			setTimeout(resetState, 300);
		}
	};

	const selectedRegion = ALL_REGIONS.find(
		(region) => region.value === selectedLocation,
	);

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger render={<Button size="sm" className="h-8 gap-1" />}>
				<Plus className="h-3.5 w-3.5" />
				<span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
					Add Worker
				</span>
			</DialogTrigger>

			<DialogPopup className="sm:max-w-[425px]">
				{newWorkerKey ? (
					<div className="contents">
						<DialogHeader>
							<DialogTitle>Worker Created</DialogTitle>
							<DialogDescription>
								Copy the API key below. You won&apos;t be able to see it again.
							</DialogDescription>
						</DialogHeader>

						<DialogPanel className="py-4">
							<div className="flex items-center space-x-2">
								<div className="grid flex-1 gap-2">
									<label htmlFor="worker-api-key" className="sr-only">
										API Key
									</label>
									<Input
										id="worker-api-key"
										value={newWorkerKey}
										readOnly
										type={isRevealed ? "text" : "password"}
									/>
								</div>

								{isSecureContext ? (
									<Button
										type="button"
										size="sm"
										className="px-3"
										onClick={handleCopy}
									>
										<span className="sr-only">Copy</span>
										{isCopied ? (
											<span className="text-xs">Copied!</span>
										) : (
											<Copy className="h-4 w-4" />
										)}
									</Button>
								) : (
									<Button
										type="button"
										size="sm"
										variant="outline"
										className="px-3"
										onClick={() => setIsRevealed((prev) => !prev)}
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
						</DialogPanel>

						<DialogFooter>
							<DialogClose render={<Button type="button" />}>Done</DialogClose>
						</DialogFooter>
					</div>
				) : (
					<form onSubmit={handleSubmit} className="contents">
						<DialogHeader>
							<DialogTitle>Create Worker</DialogTitle>
							<DialogDescription>
								Add a new worker to your monitoring fleet.
							</DialogDescription>
						</DialogHeader>

						<DialogPanel className="grid gap-4 py-4">
							<Field>
								<FieldLabel htmlFor="name">Name</FieldLabel>
								<Input
									id="name"
									name="name"
									value={newWorkerName}
									onChange={(e) => setNewWorkerName(e.target.value)}
									placeholder="My Worker"
									required
									type="text"
								/>
							</Field>

							<Field>
								<FieldLabel htmlFor="location">Location</FieldLabel>

								<input
									id="location"
									name="location"
									value={selectedLocation}
									readOnly
									tabIndex={-1}
									className="sr-only"
								/>

								<Combobox
									items={ALL_REGIONS}
									value={selectedRegion || null}
									onValueChange={(value) => {
										if (value) {
											setSelectedLocation(value.value);
										}
									}}
								>
									<ComboboxValue>
										{(_value: (typeof ALL_REGIONS)[number] | null) => (
											<ComboboxInput
												placeholder="Select a region"
												className="w-full"
											/>
										)}
									</ComboboxValue>
									<ComboboxPopup>
										<ComboboxEmpty>No regions found.</ComboboxEmpty>
										<ComboboxList
											ref={comboboxListRef}
											className="max-h-[400px]"
										>
											<VirtualizedRegionList parentRef={comboboxListRef} />
										</ComboboxList>
									</ComboboxPopup>
								</Combobox>
							</Field>
						</DialogPanel>

						<DialogFooter>
							<DialogClose render={<Button type="button" variant="ghost" />}>
								Cancel
							</DialogClose>
							<Button type="submit" disabled={isPending}>
								{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								Create Worker
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogPopup>
		</Dialog>
	);
}
