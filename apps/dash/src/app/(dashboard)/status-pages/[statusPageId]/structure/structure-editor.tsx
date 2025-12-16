"use client";

import {
	DndContext,
	type DragEndEvent,
	type DragOverEvent,
	DragOverlay,
	type DragStartEvent,
	defaultDropAnimationSideEffects,
	KeyboardSensor,
	PointerSensor,
	rectIntersection,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	rectSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	GripHorizontal,
	GripVertical,
	Loader2,
	Plus,
	Search,
	Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

// Types
type MonitorStyle = "history" | "status";

interface MonitorItem {
	instanceId: string;
	id: string; // real monitor id
	name: string;
	style: MonitorStyle;
}

interface GroupItem {
	id: string;
	name: string;
	monitors: MonitorItem[];
}

interface StructureEditorProps {
	statusPageId: string;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export function StructureEditor({ statusPageId }: StructureEditorProps) {
	const queryClient = useQueryClient();
	const { isLoading: isPageLoading } = useQuery(
		orpc.statusPages.get.queryOptions({ input: { id: statusPageId } }),
	);
	const { data: structure, isLoading: isStructureLoading } = useQuery(
		orpc.statusPages.getStructure.queryOptions({ input: { id: statusPageId } }),
	);
	const { data: allMonitors, isLoading: isMonitorsLoading } = useQuery(
		orpc.monitors.list.queryOptions({}),
	);

	const updateStructureMutation = useMutation(
		orpc.statusPages.updateStructure.mutationOptions({
			onSuccess: () => {
				toast.success("Structure saved successfully");
				queryClient.invalidateQueries({
					queryKey: orpc.statusPages.getStructure.key({
						input: { id: statusPageId },
					}),
				});
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const [groups, setGroups] = useState<GroupItem[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [activeItem, setActiveItem] = useState<any>(null);

	// Sync structure -> local state
	useEffect(() => {
		if (structure) {
			setGroups(
				structure.groups.map((g) => ({
					id: g.id,
					name: g.name,
					monitors: g.monitors.map((m) => ({
						instanceId: generateId(),
						id: m.id,
						name: m.name,
						style: m.style as MonitorStyle,
					})),
				})),
			);
		}
	}, [structure]);

	const [layout] = useState<"vertical" | "horizontal">("vertical");

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragStart = (event: DragStartEvent) => {
		const { active } = event;
		setActiveId(active.id as string);

		// Find what we are dragging
		const group = groups.find((g) => g.id === active.id);
		if (group) {
			setActiveItem({ type: "Group", data: group });
			return;
		}

		const flatMonitors = groups.flatMap((g) => g.monitors);
		const monitor = flatMonitors.find((m) => m.instanceId === active.id);
		if (monitor) {
			setActiveItem({ type: "Monitor", data: monitor });
		}
	};

	const handleDragOver = (event: DragOverEvent) => {
		const { active, over } = event;
		if (!over) return;
		if (active.id === over.id) return;

		const activeType = activeItem?.type;
		if (activeType !== "Monitor") return;

		const overId = over.id;

		// Find items
		const activeGroupIdx = groups.findIndex((g) =>
			g.monitors.some((m) => m.instanceId === active.id),
		);
		let overGroupIdx = groups.findIndex((g) =>
			g.monitors.some((m) => m.instanceId === overId),
		);

		// If over a group directly
		if (overGroupIdx === -1) {
			overGroupIdx = groups.findIndex((g) => g.id === overId);
		}

		if (activeGroupIdx === -1 || overGroupIdx === -1) return;
		if (activeGroupIdx === overGroupIdx) return; // Same container handled by DragEnd (reorder) or native sortable? dnd-kit recommends doing it here for inter-container

		// Moving between containers
		setGroups((prev) => {
			const next = [...prev];
			const sourceGroup = next[activeGroupIdx];
			const targetGroup = next[overGroupIdx];

			const monitorIdx = sourceGroup.monitors.findIndex(
				(m) => m.instanceId === active.id,
			);
			const monitor = sourceGroup.monitors[monitorIdx];

			// Remove from source
			const newSourceMonitors = [...sourceGroup.monitors];
			newSourceMonitors.splice(monitorIdx, 1);

			// Add to target
			const newTargetMonitors = [...targetGroup.monitors];
			const isOverGroup = overId === targetGroup.id;
			let newIndex = newTargetMonitors.length;

			if (!isOverGroup) {
				const overMonitorIdx = newTargetMonitors.findIndex(
					(m) => m.instanceId === overId,
				);
				if (overMonitorIdx >= 0) newIndex = overMonitorIdx; // Insert before
			}

			newTargetMonitors.splice(newIndex, 0, monitor);

			next[activeGroupIdx] = { ...sourceGroup, monitors: newSourceMonitors };
			next[overGroupIdx] = { ...targetGroup, monitors: newTargetMonitors };

			return next;
		});
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		setActiveId(null);
		setActiveItem(null);

		if (!over) return;

		// Reordering Groups
		if (activeItem?.type === "Group" && active.id !== over.id) {
			const oldIndex = groups.findIndex((g) => g.id === active.id);
			const newIndex = groups.findIndex((g) => g.id === over.id);
			if (oldIndex !== -1 && newIndex !== -1) {
				setGroups(arrayMove(groups, oldIndex, newIndex));
			}
			return;
		}

		// Reordering Monitors within same group
		if (activeItem?.type === "Monitor") {
			const groupIdx = groups.findIndex((g) =>
				g.monitors.some((m) => m.instanceId === active.id),
			);
			if (groupIdx !== -1) {
				const group = groups[groupIdx];
				const oldIndex = group.monitors.findIndex(
					(m) => m.instanceId === active.id,
				);
				const newIndex = group.monitors.findIndex(
					(m) => m.instanceId === over.id,
				);

				if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
					const newGroups = [...groups];
					newGroups[groupIdx] = {
						...group,
						monitors: arrayMove(group.monitors, oldIndex, newIndex),
					};
					setGroups(newGroups);
				}
			}
		}
	};

	const addGroup = () => {
		setGroups([
			...groups,
			{ id: `temp-${generateId()}`, name: "", monitors: [] },
		]);
	};

	const removeGroup = (id: string) => {
		setGroups(groups.filter((g) => g.id !== id));
	};

	const updateGroupName = (id: string, name: string) => {
		setGroups(groups.map((g) => (g.id === id ? { ...g, name } : g)));
	};

	const addMonitorToGroup = (
		groupId: string,
		monitor: { id: string; name: string },
	) => {
		setGroups(
			groups.map((g) => {
				if (g.id === groupId) {
					// Allow multiple instances? Original allowed only unique per group.
					const exists = g.monitors.some((m) => m.id === monitor.id);
					if (exists) return g;
					return {
						...g,
						monitors: [
							...g.monitors,
							{
								instanceId: generateId(),
								id: monitor.id,
								name: monitor.name,
								style: "history",
							},
						],
					};
				}
				return g;
			}),
		);
	};

	const removeMonitor = (groupId: string, instanceId: string) => {
		setGroups(
			groups.map((g) => {
				if (g.id === groupId) {
					return {
						...g,
						monitors: g.monitors.filter((m) => m.instanceId !== instanceId),
					};
				}
				return g;
			}),
		);
	};

	const toggleMonitorStyle = (groupId: string, instanceId: string) => {
		setGroups(
			groups.map((g) => {
				if (g.id === groupId) {
					return {
						...g,
						monitors: g.monitors.map((m) =>
							m.instanceId === instanceId
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
				name: g.name || "Untitled Section",
				monitors: g.monitors.map((m) => ({ id: m.id, style: m.style })),
			})),
		});
	};

	if (isStructureLoading || isMonitorsLoading || isPageLoading) {
		return (
			<div className="flex justify-center p-10">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<>
			<div className="flex flex-col gap-8 pb-20">
				{/* Header / Intro */}
				<div className="grid grid-cols-1 gap-8 md:grid-cols-3">
					<div>
						<h2 className="font-semibold text-lg leading-none tracking-tight">
							Monitors & heartbeats
						</h2>
						<p className="mt-2 text-muted-foreground text-sm">
							Pick the monitors and heartbeats you want to display on your
							status page.
						</p>
						<p className="mt-2 text-muted-foreground text-sm">
							You can re-order the monitors by dragging the cards, as well as
							give each monitor a public name.
						</p>
					</div>

					<div className="space-y-6 md:col-span-2">
						<DndContext
							sensors={sensors}
							collisionDetection={rectIntersection} // Better for grid
							onDragStart={handleDragStart}
							onDragOver={handleDragOver}
							onDragEnd={handleDragEnd}
						>
							<SortableContext
								items={groups.map((g) => g.id)}
								strategy={
									layout === "horizontal"
										? rectSortingStrategy
										: verticalListSortingStrategy
								}
							>
								<div
									className={cn(
										"grid gap-4",
										layout === "horizontal"
											? "grid-cols-1 xl:grid-cols-2"
											: "grid-cols-1",
									)}
								>
									{groups.map((group) => (
										<SortableGroup
											key={group.id}
											group={group}
											allMonitors={allMonitors || []}
											onRemove={() => removeGroup(group.id)}
											onUpdateName={(name) => updateGroupName(group.id, name)}
											onAddMonitor={(m) => addMonitorToGroup(group.id, m)}
											onRemoveMonitor={(m) =>
												removeMonitor(group.id, m.instanceId)
											}
											onToggleStyle={(m) =>
												toggleMonitorStyle(group.id, m.instanceId)
											}
											layout={layout}
										/>
									))}
								</div>
							</SortableContext>

							<button
								type="button"
								onClick={addGroup}
								className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-input border-dashed p-8 transition-colors hover:bg-accent/50 hover:text-accent-foreground"
							>
								<Plus className="h-4 w-4" />
								<span className="font-medium text-sm">Add section</span>
							</button>

							{/* Overlay */}
							<DragOverlay
								dropAnimation={{
									sideEffects: defaultDropAnimationSideEffects({
										styles: { active: { opacity: "0.5" } },
									}),
								}}
							>
								{activeId && activeItem?.type === "Group" ? (
									<GroupCard
										group={activeItem.data}
										isOverlay
										layout={layout}
									/>
								) : activeId && activeItem?.type === "Monitor" ? (
									<MonitorRow monitor={activeItem.data} isOverlay />
								) : null}
							</DragOverlay>
						</DndContext>
					</div>
				</div>
			</div>

			<div className="fixed right-0 bottom-0 left-0 z-0 flex justify-end border-t bg-background/80 p-4 backdrop-blur-sm">
				<Button
					onClick={handleSave}
					disabled={updateStructureMutation.isPending}
				>
					{updateStructureMutation.isPending && (
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					)}
					Save changes
				</Button>
			</div>
		</>
	);
}

// Components

function SortableGroup({
	group,
	allMonitors,
	onRemove,
	onUpdateName,
	onAddMonitor,
	onRemoveMonitor,
	onToggleStyle,
	layout,
}: {
	group: GroupItem;
	allMonitors: { id: string; name: string }[];
	onRemove: () => void;
	onUpdateName: (val: string) => void;
	onAddMonitor: (m: { id: string; name: string }) => void;
	onRemoveMonitor: (m: MonitorItem) => void;
	onToggleStyle: (m: MonitorItem) => void;
	layout: "vertical" | "horizontal";
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: group.id,
		data: { type: "Group", group },
	});

	const style = {
		transform: CSS.Translate.toString(transform),
		transition,
		zIndex: isDragging ? 10 : undefined,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			{...attributes}
			className={cn("h-full", isDragging && "opacity-50")}
		>
			<GroupCard
				group={group}
				listeners={listeners}
				allMonitors={allMonitors}
				onRemove={onRemove}
				onUpdateName={onUpdateName}
				onAddMonitor={onAddMonitor}
				onRemoveMonitor={onRemoveMonitor}
				onToggleStyle={onToggleStyle}
				layout={layout}
			/>
		</div>
	);
}

function GroupCard({
	group,
	isOverlay,
	listeners,
	allMonitors,
	onRemove,
	onUpdateName,
	onAddMonitor,
	onRemoveMonitor,
	onToggleStyle,
}: any) {
	return (
		<Card
			className={cn(
				"group/card relative overflow-hidden border-border bg-card shadow-sm",
				isOverlay && "shadow-xl ring-2 ring-primary ring-opacity-50",
			)}
		>
			<div
				{...listeners}
				className="absolute top-0 right-0 left-0 z-10 flex h-4 cursor-grab items-center justify-center transition-colors hover:bg-muted/50 active:cursor-grabbing"
			>
				<GripHorizontal className="h-4 w-4 text-muted-foreground/30 transition-colors group-hover/card:text-muted-foreground/60" />
			</div>

			<CardContent className="relative space-y-6 p-6 pt-6">
				{onRemove && (
					<div className="absolute top-[44px] right-4 z-20">
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover/card:opacity-100"
							onClick={onRemove}
							onPointerDown={(e) => e.stopPropagation()}
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					</div>
				)}

				{/* Header / Config */}
				<div className="space-y-4">
					<div className="space-y-1.5 pr-10">
						{" "}
						{/* pr-10 for trash icon space */}
						<Label className="font-normal text-muted-foreground text-xs">
							Section name
						</Label>
						<Input
							value={group.name}
							onChange={(e) => onUpdateName && onUpdateName(e.target.value)}
							placeholder="e.g. Core Services"
							className="border-input/50 bg-muted/30"
							onPointerDown={(e) => e.stopPropagation()}
						/>
					</div>

					{/* Resources Input (Search to add) */}
					<div className="space-y-1.5">
						<Label className="font-normal text-muted-foreground text-xs">
							Resources
						</Label>
						{onAddMonitor && (
							<AddMonitorInput
								onAdd={onAddMonitor}
								availableMonitors={allMonitors}
								existingMonitorIds={group.monitors.map((m: any) => m.id)}
							/>
						)}
					</div>
				</div>

				{/* Monitor List */}
				<div className="space-y-1">
					<SortableContext
						items={group.monitors.map((m: any) => m.instanceId)}
						strategy={verticalListSortingStrategy}
					>
						{group.monitors.map((monitor: any) => (
							<SortableMonitor
								key={monitor.instanceId}
								monitor={monitor}
								onRemove={() => onRemoveMonitor(monitor)}
								onToggleStyle={() => onToggleStyle(monitor)}
							/>
						))}
					</SortableContext>
				</div>
			</CardContent>
		</Card>
	);
}

function AddMonitorInput({
	onAdd,
	availableMonitors,
	existingMonitorIds,
}: any) {
	const [open, setOpen] = useState(false);
	const existingSet = new Set(existingMonitorIds);

	// This simulates the "Search to add resources" box from screenshot
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="w-full justify-start border-input/50 bg-muted/30 font-normal text-muted-foreground"
					onPointerDown={(e) => e.stopPropagation()}
				>
					<Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
					Search to add resources
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[400px] p-0" align="start">
				<Command>
					<CommandInput placeholder="Search monitors..." />
					<CommandList>
						<CommandEmpty>No monitor found.</CommandEmpty>
						<CommandGroup>
							{availableMonitors
								.filter((m: any) => !existingSet.has(m.id))
								.map((monitor: any) => (
									<CommandItem
										key={monitor.id}
										value={monitor.name}
										onSelect={() => {
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

function SortableMonitor({ monitor, onRemove, onToggleStyle }: any) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: monitor.instanceId,
		data: { type: "Monitor", monitor },
	});

	const style = {
		transform: CSS.Translate.toString(transform),
		transition,
		zIndex: isDragging ? 20 : undefined,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			{...attributes}
			className={cn("relative", isDragging && "z-50")}
		>
			<MonitorRow
				monitor={monitor}
				listeners={listeners}
				onRemove={onRemove}
				onToggleStyle={onToggleStyle}
				isDragging={isDragging}
			/>
		</div>
	);
}

function MonitorRow({
	monitor,
	isOverlay,
	isDragging,
	listeners,
	onRemove,
	onToggleStyle,
}: any) {
	return (
		<div
			className={cn(
				"group flex items-center gap-3 rounded-md p-3 transition-all hover:bg-muted/40",
				isOverlay && "border bg-background shadow-lg",
				isDragging && "opacity-50",
			)}
		>
			{/* Drag Handle */}
			<div
				{...listeners}
				className="cursor-grab text-muted-foreground/30 active:cursor-grabbing group-hover:text-muted-foreground"
			>
				<GripVertical className="h-4 w-4" />
			</div>

			{/* Icon + Name */}
			<div className="flex min-w-0 flex-1 items-center gap-3">
				{/* We could add status icons here if we had them in monitor data */}
				{/* <Activity className="h-4 w-4 text-emerald-500 shrink-0" /> */}
				<span className="truncate font-medium text-sm">{monitor.name}</span>
			</div>

			{/* Actions */}
			<div className="flex items-center gap-2">
				<Badge
					variant="secondary"
					className="hidden h-6 cursor-pointer gap-1 font-normal text-xs transition-colors hover:bg-secondary/80 sm:flex"
					onClick={onToggleStyle}
					onPointerDown={(e) => e.stopPropagation()}
				>
					{monitor.style === "history" ? "With status history" : "Status only"}
				</Badge>

				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-muted-foreground/30 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
					onClick={onRemove}
					onPointerDown={(e) => e.stopPropagation()}
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}
