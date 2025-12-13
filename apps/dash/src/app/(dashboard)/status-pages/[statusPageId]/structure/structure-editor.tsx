"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	GripVertical,
	Plus,
	Trash2,
	ChevronDown,
	ChevronUp,
	BarChart,
	Activity,
	Settings2,
	Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";
import { toast } from "sonner";

// Types
type MonitorStyle = "history" | "status";

interface Monitor {
	id: string;
	name: string;
	style: MonitorStyle;
}

interface Group {
	id: string; // group UUID or temporary ID
	name: string;
	monitors: Monitor[];
	isCollapsed?: boolean;
}

interface StructureEditorProps {
	statusPageId: string;
}

export function StructureEditor({ statusPageId }: StructureEditorProps) {
	const { data: structure, isLoading: isStructureLoading } = useQuery(
		orpc.statusPages.getStructure.queryOptions({
			input: { id: statusPageId },
		}),
	);

	const { data: allMonitors, isLoading: isMonitorsLoading } = useQuery(
		orpc.monitors.list.queryOptions({}),
	);

	const updateStructureMutation = useMutation(
		orpc.statusPages.updateStructure.mutationOptions({
			onSuccess: () => {
				toast.success("Structure saved successfully");
			},
			onError: (err) => {
				toast.error(err.message);
			},
		}),
	);

	const [groups, setGroups] = useState<Group[]>([]);

	useEffect(() => {
		if (structure) {
			setGroups(
				structure.groups.map((g) => ({
					id: g.id,
					name: g.name,
					monitors: g.monitors.map((m) => ({
						id: m.id,
						name: m.name,
						style: m.style as MonitorStyle,
					})),
				})),
			);
		}
	}, [structure]);

	const moveGroup = (index: number, direction: "up" | "down") => {
		if (direction === "up" && index > 0) {
			const newGroups = [...groups];
			[newGroups[index - 1], newGroups[index]] = [
				newGroups[index],
				newGroups[index - 1],
			];
			setGroups(newGroups);
		} else if (direction === "down" && index < groups.length - 1) {
			const newGroups = [...groups];
			[newGroups[index + 1], newGroups[index]] = [
				newGroups[index],
				newGroups[index + 1],
			];
			setGroups(newGroups);
		}
	};

	const addGroup = () => {
		setGroups([
			...groups,
			{ id: `temp-g-${Date.now()}`, name: "New Group", monitors: [] },
		]);
	};

	const removeGroup = (groupId: string) => {
		setGroups(groups.filter((g) => g.id !== groupId));
	};

	const updateGroupName = (groupId: string, newName: string) => {
		setGroups(
			groups.map((g) => (g.id === groupId ? { ...g, name: newName } : g)),
		);
	};

	const addMonitorToGroup = (
		groupId: string,
		monitor: { id: string; name: string },
	) => {
		setGroups(
			groups.map((g) => {
				if (g.id === groupId) {
					// Check if already exists
					if (g.monitors.find((m) => m.id === monitor.id)) return g;
					return {
						...g,
						monitors: [...g.monitors, { ...monitor, style: "history" }],
					};
				}
				return g;
			}),
		);
	};

	const removeMonitorFromGroup = (groupId: string, monitorId: string) => {
		setGroups(
			groups.map((g) => {
				if (g.id === groupId) {
					return {
						...g,
						monitors: g.monitors.filter((m) => m.id !== monitorId),
					};
				}
				return g;
			}),
		);
	};

	const moveMonitor = (
		groupId: string,
		monitorIndex: number,
		direction: "up" | "down",
	) => {
		setGroups(
			groups.map((g) => {
				if (g.id === groupId) {
					const newMonitors = [...g.monitors];
					if (direction === "up" && monitorIndex > 0) {
						[newMonitors[monitorIndex - 1], newMonitors[monitorIndex]] = [
							newMonitors[monitorIndex],
							newMonitors[monitorIndex - 1],
						];
					} else if (
						direction === "down" &&
						monitorIndex < newMonitors.length - 1
					) {
						[newMonitors[monitorIndex + 1], newMonitors[monitorIndex]] = [
							newMonitors[monitorIndex],
							newMonitors[monitorIndex + 1],
						];
					}
					return { ...g, monitors: newMonitors };
				}
				return g;
			}),
		);
	};

	const toggleMonitorStyle = (groupId: string, monitorId: string) => {
		setGroups(
			groups.map((g) => {
				if (g.id === groupId) {
					return {
						...g,
						monitors: g.monitors.map((m) =>
							m.id === monitorId
								? { ...m, style: m.style === "history" ? "status" : "history" }
								: m,
						),
					};
				}
				return g;
			}),
		);
	};

	const handleSave = () => {
		updateStructureMutation.mutate({
			id: statusPageId,
			groups: groups.map((g) => ({
				id: g.id.startsWith("temp-") ? undefined : g.id,
				name: g.name,
				monitors: g.monitors.map((m) => ({
					id: m.id,
					style: m.style,
				})),
			})),
		});
	};

	if (isStructureLoading || isMonitorsLoading) {
		return (
			<div className="flex justify-center p-10">
				<Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-6 pb-20">
			<div className="flex justify-between items-center">
				<div>
					<h2 className="text-lg font-medium">Structure</h2>
					<p className="text-sm text-muted-foreground">
						Organize your monitors into groups and customize their display.
					</p>
				</div>
				<Button onClick={addGroup} size="sm" className="gap-2">
					<Plus className="h-4 w-4" /> Add Group
				</Button>
			</div>

			<div className="space-y-4">
				{groups.map((group, groupIndex) => (
					<Card
						key={group.id}
						className="relative group/card transition-all hover:border-primary/50"
					>
						<CardHeader className="flex flex-row items-center space-y-0 gap-4 py-3 px-4 bg-muted/30">
							<div className="flex flex-col gap-1">
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6 text-muted-foreground hover:text-foreground"
									disabled={groupIndex === 0}
									onClick={() => moveGroup(groupIndex, "up")}
								>
									<ChevronUp className="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6 text-muted-foreground hover:text-foreground"
									disabled={groupIndex === groups.length - 1}
									onClick={() => moveGroup(groupIndex, "down")}
								>
									<ChevronDown className="h-4 w-4" />
								</Button>
							</div>

							<div className="flex-1">
								<Input
									value={group.name}
									onChange={(e) => updateGroupName(group.id, e.target.value)}
									className="h-8 font-medium bg-transparent border-transparent hover:border-input focus:bg-background focus:border-input transition-colors w-full max-w-[300px]"
								/>
							</div>

							<AddMonitorButton
								existingMonitorIds={new Set(group.monitors.map((m) => m.id))}
								availableMonitors={allMonitors || []}
								onAdd={(m) => addMonitorToGroup(group.id, m)}
							/>

							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 text-muted-foreground hover:text-destructive"
								onClick={() => removeGroup(group.id)}
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</CardHeader>
						<CardContent className="p-2 pt-0">
							{group.monitors.length === 0 ? (
								<div className="p-8 text-center text-sm text-muted-foreground border-t border-dashed bg-muted/10">
									No monitors in this group. Add one to get started.
								</div>
							) : (
								<div className="divide-y border-t">
									{group.monitors.map((monitor, index) => (
										<div
											key={monitor.id}
											className="flex items-center gap-4 p-3 hover:bg-muted/20"
										>
											<div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
												<Button
													variant="ghost"
													size="icon"
													className="h-5 w-5"
													disabled={index === 0}
													onClick={() => moveMonitor(group.id, index, "up")}
												>
													<ChevronUp className="h-3 w-3" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													className="h-5 w-5"
													disabled={index === group.monitors.length - 1}
													onClick={() => moveMonitor(group.id, index, "down")}
												>
													<ChevronDown className="h-3 w-3" />
												</Button>
											</div>

											<div className="flex-1 text-sm font-medium">
												{monitor.name}
											</div>

											<div className="flex items-center gap-2">
												<div
													className="flex cursor-pointer select-none items-center gap-2 rounded-md bg-muted px-2 py-1 text-muted-foreground text-xs hover:bg-muted/80"
													onClick={() =>
														toggleMonitorStyle(group.id, monitor.id)
													}
												>
													{monitor.style === "history" ? (
														<>
															<BarChart className="h-3 w-3" />
															<span>History</span>
														</>
													) : (
														<>
															<Activity className="h-3 w-3" />
															<span>Status only</span>
														</>
													)}
												</div>

												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8 text-muted-foreground hover:text-destructive"
													onClick={() =>
														removeMonitorFromGroup(group.id, monitor.id)
													}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				))}

				{groups.length === 0 && (
					<div
						onClick={addGroup}
						className="border-2 border-dashed rounded-lg p-12 text-center hover:bg-muted/50 cursor-pointer transition-colors"
					>
						<div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
							<Settings2 className="h-6 w-6 text-muted-foreground" />
						</div>
						<h3 className="text-lg font-medium">No groups defined</h3>
						<p className="text-sm text-muted-foreground mt-1">
							Create a group to start adding monitors.
						</p>
					</div>
				)}
			</div>

			<div className=" fixed bottom-0 left-0 right-0 p-4 border-t bg-background/80 backdrop-blur-sm z-10">
				<div className="max-w-7xl mx-auto flex justify-end gap-4">
					<Button
						onClick={handleSave}
						disabled={updateStructureMutation.isPending}
					>
						{updateStructureMutation.isPending && (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						)}
						Save structure
					</Button>
				</div>
			</div>
		</div>
	);
}

function AddMonitorButton({
	existingMonitorIds,
	availableMonitors,
	onAdd,
}: {
	existingMonitorIds: Set<string>;
	availableMonitors: { id: string; name: string }[];
	onAdd: (m: { id: string; name: string }) => void;
}) {
	const [open, setOpen] = useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="h-8 justify-between text-xs"
				>
					<Plus className="mr-2 h-3 w-3" />
					Add Monitor
				</Button>
			</PopoverTrigger>
			<PopoverContent className="p-0 w-[200px]" align="start">
				<Command>
					<CommandInput placeholder="Search monitors..." className="h-9" />
					<CommandList>
						<CommandEmpty>No monitor found.</CommandEmpty>
						<CommandGroup>
							{availableMonitors
								.filter((m) => !existingMonitorIds.has(m.id))
								.map((monitor) => (
									<CommandItem
										key={monitor.id}
										value={monitor.name}
										onSelect={(currentValue) => {
											onAdd(monitor);
											setOpen(false);
										}}
									>
										{monitor.name}
									</CommandItem>
								))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
