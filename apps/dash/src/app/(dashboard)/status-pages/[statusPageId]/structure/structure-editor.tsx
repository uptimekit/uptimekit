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
	Info,
	Loader2,
	Plus,
	Search,
	Settings2,
	Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

// Types
type MonitorStyle = "history" | "status";

interface MonitorItem {
	instanceId: string;
	id: string; // real monitor id
	name: string;
	style: MonitorStyle;
	description?: string | null;
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

/**
 * Render a drag-and-drop editor for configuring a status page's groups and monitors.
 *
 * Loads the status page, its current structure, and available monitors; provides UI and interactions
 * to create, rename, reorder, group, configure, and remove monitors, and to persist the resulting structure.
 *
 * @param statusPageId - The ID of the status page being edited
 * @returns A JSX element containing the structure editor UI
 */
export function StructureEditor({ statusPageId }: StructureEditorProps) {
	const queryClient = useQueryClient();
	const { isLoading: isPageLoading } = useQuery(
		orpc.statusPages.get.queryOptions({ input: { id: statusPageId } }),
	);
	const { data: structure, isLoading: isStructureLoading } = useQuery(
		orpc.statusPages.getStructure.queryOptions({ input: { id: statusPageId } }),
	);
	const { data: monitorsData, isLoading: isMonitorsLoading } = useQuery(
		orpc.monitors.list.queryOptions({ limit: 100 }),
	);
	const allMonitors = monitorsData?.items || [];

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
						description: m.description,
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

	const updateMonitorConfig = (
		groupId: string,
		instanceId: string,
		updates: Partial<MonitorItem>,
	) => {
		setGroups(
			groups.map((g) => {
				if (g.id === groupId) {
					return {
						...g,
						monitors: g.monitors.map((m) =>
							m.instanceId === instanceId ? { ...m, ...updates } : m,
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
				monitors: g.monitors.map((m) => ({
					id: m.id,
					style: m.style,
					description: m.description,
				})),
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
											onConfigChange={(m, updates) =>
												updateMonitorConfig(group.id, m.instanceId, updates)
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
	onConfigChange,
	layout,
}: {
	group: GroupItem;
	allMonitors: { id: string; name: string }[];
	onRemove: () => void;
	onUpdateName: (val: string) => void;
	onAddMonitor: (m: { id: string; name: string }) => void;
	onRemoveMonitor: (m: MonitorItem) => void;
	onConfigChange: (m: MonitorItem, updates: Partial<MonitorItem>) => void;
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
				onConfigChange={onConfigChange}
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
	onConfigChange,
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
								onConfigChange={(updates) => onConfigChange(monitor, updates)}
							/>
						))}
					</SortableContext>
				</div>
			</CardContent>
		</Card>
	);
}

/**
 * Renders a searchable popover control for adding monitors to a group.
 *
 * The control lists `availableMonitors` excluding any whose ids appear in `existingMonitorIds`; selecting an item invokes `onAdd` with the chosen monitor and closes the popover.
 *
 * @param onAdd - Callback invoked with the selected monitor object when a monitor is chosen
 * @param availableMonitors - Array of monitor objects available for addition; each must include an `id` and `name`
 * @param existingMonitorIds - Array of monitor ids that should be excluded from the choices
 * @returns The Add Monitor input popover component
 */
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
			<PopoverTrigger
				render={
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
				}>
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

/**
 * A draggable monitor list item that renders a MonitorRow and wires drag-and-drop behavior.
 *
 * @param monitor - The monitor instance to display (includes instanceId, id, name, style, and optional description).
 * @param onRemove - Called when the monitor should be removed from its group.
 * @param onConfigChange - Called with partial monitor fields to update the monitor's configuration.
 * @returns A JSX element representing a draggable monitor row connected to the DnD system.
 */
function SortableMonitor({
	monitor,
	onRemove,
	onConfigChange,
}: {
	monitor: MonitorItem;
	onRemove: () => void;
	onConfigChange: (updates: Partial<MonitorItem>) => void;
}) {
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
				onConfigChange={onConfigChange}
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
	onConfigChange,
}: {
	monitor: MonitorItem;
	isOverlay?: boolean;
	isDragging?: boolean;
	listeners?: any;
	onRemove?: () => void;
	onConfigChange?: (updates: Partial<MonitorItem>) => void;
}) {
	const [isConfigOpen, setIsConfigOpen] = useState(false);

	return (
		<>
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
					<span className="truncate font-medium text-sm">{monitor.name}</span>
				</div>

				{/* Actions */}
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 text-muted-foreground/50 transition-colors hover:text-foreground"
						onClick={() => setIsConfigOpen(true)}
						onPointerDown={(e) => e.stopPropagation()}
					>
						<Settings2 className="h-4 w-4" />
					</Button>

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

			{/* Configuration Modal */}
			<MonitorConfigModal
				monitor={monitor}
				open={isConfigOpen}
				onOpenChange={setIsConfigOpen}
				onConfigChange={onConfigChange}
			/>
		</>
	);
}

// Monitor Configuration Modal
function MonitorConfigModal({
	monitor,
	open,
	onOpenChange,
	onConfigChange,
}: {
	monitor: MonitorItem;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfigChange?: (updates: Partial<MonitorItem>) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Configure Monitor Display</DialogTitle>
					<DialogDescription>
						Choose how this monitor will appear on your status page.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* Preview */}
					<div className="space-y-2">
						<Label className="font-normal text-muted-foreground text-xs">
							Preview
						</Label>
						<div className="rounded-2xl border border-border bg-card p-6">
							<MonitorPreview
								name={monitor.name}
								style={monitor.style}
								description={monitor.description}
							/>
						</div>
					</div>

					{/* Display Style Select */}
					<div className="space-y-2">
						<Label className="font-normal text-muted-foreground text-xs">
							Display Type
						</Label>
						<Select
							value={monitor.style}
							onValueChange={(value) =>
								onConfigChange?.({ style: value as MonitorStyle })
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="history">With History</SelectItem>
								<SelectItem value="status">Status Only</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Description */}
					<div className="space-y-2">
						<Label className="font-normal text-muted-foreground text-xs">
							Description (optional)
						</Label>
						<Textarea
							value={monitor.description || ""}
							onChange={(e) =>
								onConfigChange?.({ description: e.target.value || null })
							}
							placeholder="Add a description that will appear in an info tooltip..."
							rows={3}
						/>
						<p className="text-muted-foreground text-xs">
							If provided, an info icon will appear next to the monitor name.
						</p>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

// Monitor Preview Component - shows how monitor will look on status page
/**
 * Render a visual preview of a monitor as it will appear on the status page for the given display style.
 *
 * Shows a compact status-only representation when `style` is "status" and a history-style view with a 90-day uptime bar when `style` is "history".
 *
 * @param name - The monitor's display name.
 * @param style - The monitor display style; `"history"` shows an uptime bar and `"status"` shows current status.
 * @param description - Optional descriptive text shown in a tooltip next to the name.
 * @returns A JSX element containing the monitor preview for the specified style.
 */
function MonitorPreview({
	name,
	style,
	description,
}: {
	name: string;
	style: MonitorStyle;
	description?: string | null;
}) {
	// Generate placeholder data - always operational
	const placeholderHistory = Array.from({ length: 90 }, (_, i) => {
		const date = new Date();
		date.setDate(date.getDate() - (89 - i));
		return {
			date: date.toISOString().split("T")[0],
			status: "operational" as const,
			uptime: 100,
		};
	});

	// Status-only mode: show only name and current status (matches MonitorListItem from status-page)
	if (style === "status") {
		return (
			<div>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						{/* Status Dot */}
						<span className="relative flex h-2.5 w-2.5">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
							<span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
						</span>
						<span className="font-semibold text-foreground text-lg">
							{name}
						</span>
						{description && (
							<Tooltip>
								<TooltipTrigger
									render={<Info className="h-4 w-4 text-muted-foreground/60" />}
								/>
								<TooltipContent>
									<p className="max-w-xs text-sm">{description}</p>
								</TooltipContent>
							</Tooltip>
						)}
					</div>
					<span className="font-medium text-green-500 text-sm">
						Operational
					</span>
				</div>
			</div>
		);
	}

	// History mode: show full uptime bar with history (matches MonitorListItem from status-page)
	return (
		<div>
			<div className="mb-3 flex items-center justify-between">
				<div className="flex items-center gap-3">
					{/* Status Dot */}
					<span className="relative flex h-2.5 w-2.5">
						<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
						<span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
					</span>
					<span className="font-semibold text-foreground text-lg">{name}</span>
					{description && (
						<Tooltip>
							<TooltipTrigger
								render={<Info className="h-4 w-4 text-muted-foreground/60" />}
							/>
							<TooltipContent>
								<p className="max-w-xs text-sm">{description}</p>
							</TooltipContent>
						</Tooltip>
					)}
				</div>
				<span className="font-medium text-green-500 text-sm">
					99.81% uptime
				</span>
			</div>

			{/* Uptime Bar */}
			<div className="flex h-8 w-full gap-[3px]">
				{placeholderHistory.map((day) => (
					<div
						key={day.date}
						className="flex-1 rounded-[1px] bg-green-500 first:rounded-l-sm last:rounded-r-sm"
					/>
				))}
			</div>

			{/* Legend */}
			<div className="mt-2 flex select-none justify-between text-muted-foreground/60 text-xs">
				<span>90 days ago</span>
				<span>Today</span>
			</div>
		</div>
	);
}
