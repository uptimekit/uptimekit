"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { sileo } from "sileo";
import { Check, RefreshCw } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	ALL_REGIONS,
	getRegionInfo,
	REGIONS_BY_CONTINENT,
} from "@/lib/regions";
import { orpc } from "@/utils/orpc";

interface WorkerGeneralInfoFormProps {
	worker: {
		id: string;
		name: string;
		location: string;
	};
}

export function WorkerGeneralInfoForm({ worker }: WorkerGeneralInfoFormProps) {
	const [savedName, setSavedName] = useState(worker.name);
	const [savedLocation, setSavedLocation] = useState(worker.location);
	const [name, setName] = useState(worker.name);
	const [selectedLocation, setSelectedLocation] = useState(worker.location);

	const router = useRouter();
	const queryClient = useQueryClient();

	useEffect(() => {
		setSavedName(worker.name);
		setSavedLocation(worker.location);
		setName(worker.name);
		setSelectedLocation(worker.location);
	}, [worker.name, worker.location]);

	const { mutate, isPending } = useMutation({
		...orpc.workers.update.mutationOptions(),
		onSuccess: (updatedWorker) => {
			setSavedName(updatedWorker.name);
			setSavedLocation(updatedWorker.location);
			setName(updatedWorker.name);
			setSelectedLocation(updatedWorker.location);
			sileo.success({ title: "Worker updated" });
			queryClient.invalidateQueries({ queryKey: orpc.workers.list.key() });
			queryClient.invalidateQueries({
				queryKey: orpc.workers.listActive.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.workers.listLocations.key(),
			});
			queryClient.invalidateQueries({ queryKey: orpc.monitors.list.key() });
			router.refresh();
		},
		onError: (error: Error) => {
			sileo.error({ title: error.message });
		},
	});

	const trimmedName = name.trim();
	const hasChanges =
		trimmedName !== savedName || selectedLocation !== savedLocation;
	const selectedRegion = getRegionInfo(selectedLocation);
	const hasKnownSelectedLocation = ALL_REGIONS.some(
		(region) => region.value === selectedLocation,
	);

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!trimmedName) {
			sileo.error({ title: "Name is required" });
			return;
		}

		if (!selectedLocation) {
			sileo.error({ title: "Location is required" });
			return;
		}

		mutate({
			id: worker.id,
			name: trimmedName,
			location: selectedLocation,
		});
	};

	const resetForm = () => {
		setName(savedName);
		setSelectedLocation(savedLocation);
	};

	return (
		<Card>
			<form onSubmit={handleSubmit}>
				<CardHeader>
					<CardTitle>General Information</CardTitle>
					<CardDescription>Update worker details.</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4">
					<Field>
						<FieldLabel htmlFor="worker-name">Name</FieldLabel>
						<Input
							id="worker-name"
							name="name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							disabled={isPending}
							required
							type="text"
						/>
						<FieldDescription>
							This label is used throughout worker lists and monitor views.
						</FieldDescription>
					</Field>
					<Field>
						<FieldLabel htmlFor="worker-location">Location</FieldLabel>
						<Combobox
							items={
								hasKnownSelectedLocation
									? ALL_REGIONS
									: [selectedRegion, ...ALL_REGIONS]
							}
							value={selectedRegion}
							onValueChange={(value) => {
								if (value) {
									setSelectedLocation(value.value);
								}
							}}
							searchParamKey="worker-location"
							disabled={isPending}
						>
							<ComboboxValue>
								{(_value: (typeof ALL_REGIONS)[number] | null) => (
									<ComboboxInput
										id="worker-location"
										placeholder="Select a region"
										className="w-full"
									/>
								)}
							</ComboboxValue>
							<ComboboxPopup>
								<ComboboxEmpty>No regions found.</ComboboxEmpty>
								<ComboboxList className="max-h-[400px]">
									{!hasKnownSelectedLocation && (
										<ComboboxGroup>
											<ComboboxGroupLabel>Current</ComboboxGroupLabel>
											<ComboboxItem value={selectedRegion}>
												<div className="flex items-center gap-2">
													<selectedRegion.Flag className="size-4 shrink-0 rounded-sm" />
													<span>{selectedRegion.label}</span>
												</div>
											</ComboboxItem>
										</ComboboxGroup>
									)}
									{REGIONS_BY_CONTINENT.map((group) => (
										<ComboboxGroup key={group.continent}>
											<ComboboxGroupLabel>{group.continent}</ComboboxGroupLabel>
											{group.regions.map((region) => (
												<ComboboxItem key={region.value} value={region}>
													<div className="flex items-center gap-2">
														<region.Flag className="size-4 shrink-0 rounded-sm" />
														<span>{region.label}</span>
													</div>
												</ComboboxItem>
											))}
										</ComboboxGroup>
									))}
								</ComboboxList>
							</ComboboxPopup>
						</Combobox>
						<FieldDescription>
							Assigned monitors will use the worker's new location after saving.
						</FieldDescription>
					</Field>
				</CardContent>
				<CardFooter className="justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={resetForm}
						disabled={isPending || !hasChanges}
					>
						<RefreshCw className="h-4 w-4" />
						Reset
					</Button>
					<Button
						type="submit"
						loading={isPending}
						disabled={!hasChanges || !trimmedName}
					>
						<Check className="h-4 w-4" />
						Save changes
					</Button>
				</CardFooter>
			</form>
		</Card>
	);
}
