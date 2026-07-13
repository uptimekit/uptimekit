"use client";

import {
    faArrowRight,
    faCircleCheck,
    faEllipsis,
    faPencil,
    faShieldHalved,
    faTrash,
    faWrench,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistance, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { sileo } from "sileo";
import { z } from "zod";
import { GroupedMonitorCombobox } from "@/components/monitors/grouped-monitor-combobox";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxEmpty,
    ComboboxItem,
    ComboboxList,
    ComboboxPopup,
    ComboboxValue,
} from "@/components/ui/combobox";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
    Dialog,
    DialogFooter,
    DialogHeader,
    DialogPanel,
    DialogPopup,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentTime } from "@/hooks/use-current-time";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

const editIncidentSchema = z
    .object({
        title: z.string().min(1, "Title is required"),
        description: z.string().optional(),
        severity: z.enum(["minor", "major", "critical", "maintenance"]),
        startedAt: z.date(),
        plannedEndAt: z.date().nullable(),
        endedAt: z.date().nullable(),
        monitorIds: z.array(z.string()),
        statusPageIds: z.array(z.string()),
    })
    .refine((value) => !value.endedAt || value.endedAt >= value.startedAt, {
        message: "End time cannot be before start time",
        path: ["endedAt"],
    });

type EditIncidentValues = z.infer<typeof editIncidentSchema>;

type EditableActivity = {
    id: string;
    message: string;
    createdAt: string | Date;
};

type IncidentHeaderState =
    | "resolved-incident"
    | "resolved-maintenance"
    | "active-incident"
    | "acknowledged-incident"
    | "scheduled-maintenance"
    | "scheduled-maintenance-acknowledged"
    | "active-maintenance"
    | "active-maintenance-acknowledged";

function getIncidentHeaderState({
    isResolved,
    isAcknowledged,
    isMaintenance,
    isScheduledMaintenance,
}: {
    isResolved: boolean;
    isAcknowledged: boolean;
    isMaintenance: boolean;
    isScheduledMaintenance: boolean;
}): IncidentHeaderState {
    if (isResolved) {
        return isMaintenance ? "resolved-maintenance" : "resolved-incident";
    }
    if (!isMaintenance) {
        return isAcknowledged ? "acknowledged-incident" : "active-incident";
    }

    const phase = isScheduledMaintenance ? "scheduled" : "active";
    return `${phase}-maintenance${isAcknowledged ? "-acknowledged" : ""}`;
}

function IncidentHeader({
    incident,
    id,
    state,
    acknowledge,
    resolve,
    setEditOpen,
    setShowDeleteDialog,
}: {
    incident: any;
    id: string;
    state: IncidentHeaderState;
    acknowledge: {
        mutate: (input: { id: string }) => void;
        isPending: boolean;
    };
    resolve: { mutate: (input: { id: string }) => void; isPending: boolean };
    setEditOpen: (open: boolean) => void;
    setShowDeleteDialog: (open: boolean) => void;
}) {
    const isResolved = state.startsWith("resolved");
    const isAcknowledged = state.includes("acknowledged");
    const isMaintenance = state.includes("maintenance");
    const isScheduledMaintenance = state.startsWith("scheduled");

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div
                        className={cn(
                            "flex h-12 w-12 items-center justify-center rounded-xl border",
                            isMaintenance
                                ? "border-blue-500/20 bg-blue-500/10 text-blue-500"
                                : isResolved
                                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                                  : "border-red-500/20 bg-red-500/10 text-red-500",
                        )}
                    >
                        {isMaintenance ? (
                            <FontAwesomeIcon
                                icon={faWrench}
                                className="h-6 w-6"
                            />
                        ) : isResolved ? (
                            <FontAwesomeIcon
                                icon={faCircleCheck}
                                className="h-6 w-6"
                            />
                        ) : (
                            <FontAwesomeIcon
                                icon={faShieldHalved}
                                className="h-6 w-6"
                            />
                        )}
                    </div>

                    <div>
                        <h1 className="font-bold text-2xl tracking-tight">
                            {incident.title}
                        </h1>

                        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
                            <span
                                className={cn(
                                    "font-medium",
                                    isResolved
                                        ? "text-emerald-500"
                                        : "text-red-500",
                                )}
                            >
                                {isMaintenance
                                    ? isResolved
                                        ? "Completed"
                                        : isScheduledMaintenance
                                          ? "Scheduled"
                                          : "In progress"
                                    : isResolved
                                      ? "Resolved"
                                      : "Ongoing"}
                            </span>
                            <span>·</span>
                            <span>
                                Started{" "}
                                {format(
                                    new Date(incident.startedAt),
                                    "MMM d, yyyy 'at' h:mm a",
                                )}
                            </span>
                            {(incident.statusPages?.length ?? 0) > 0 && (
                                <>
                                    <span>·</span>
                                    <Badge variant="secondary">Public</Badge>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!isResolved && !isAcknowledged && (
                        <Button
                            variant="outline"
                            onClick={() => acknowledge.mutate({ id })}
                            disabled={acknowledge.isPending}
                        >
                            Acknowledge
                        </Button>
                    )}
                    {!isResolved && (
                        <Button
                            variant="outline"
                            onClick={() => resolve.mutate({ id })}
                            disabled={resolve.isPending}
                        >
                            Resolve
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => setEditOpen(true)}>
                        <FontAwesomeIcon
                            icon={faPencil}
                            className="mr-2 h-4 w-4"
                        />
                        Edit
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon" />}
                        >
                            <FontAwesomeIcon
                                icon={faEllipsis}
                                className="h-4 w-4"
                            />
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                className="text-red-500"
                                onSelect={() => setShowDeleteDialog(true)}
                            >
                                <FontAwesomeIcon
                                    icon={faTrash}
                                    className="mr-2 h-4 w-4"
                                />
                                Delete incident
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>
    );
}

function IncidentTimeline({
    incident,
    id,
    isMaintenance,
    comment,
    setComment,
    submitComment,
    setActivityToEdit,
}: {
    incident: any;
    id: string;
    isMaintenance: boolean;
    comment: string;
    setComment: (comment: string) => void;
    submitComment: {
        mutate: (input: { incidentId: string; message: string }) => void;
        isPending: boolean;
    };
    setActivityToEdit: (activity: EditableActivity | null) => void;
}) {
    return (
        <div className="min-w-[600px] space-y-6 md:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>Description</CardTitle>
                    <CardDescription>
                        {isMaintenance
                            ? "Maintenance details and affected monitors."
                            : "Incident details and affected monitors."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="prose prose-sm prose-invert max-w-none text-muted-foreground">
                        {incident.description || "No description provided."}
                    </div>

                    {(incident.monitors?.length ?? 0) > 0 && (
                        <div className="mt-4">
                            <h4 className="mb-2 font-medium text-sm">
                                Affected Monitors
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {incident.monitors.map((m: any) => (
                                    <Badge
                                        key={m.monitor.id}
                                        variant="outline"
                                        className="gap-1"
                                    >
                                        {m.monitor.name}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Timeline</CardTitle>
                    <CardDescription>
                        Activity history and comments.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Add a comment..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    const message = comment.trim();
                                    if (!message) return;
                                    submitComment.mutate({
                                        incidentId: id,
                                        message,
                                    });
                                }
                            }}
                        />
                        <Button
                            size="icon"
                            variant="outline"
                            onClick={() => {
                                const message = comment.trim();
                                if (!message) return;
                                submitComment.mutate({
                                    incidentId: id,
                                    message,
                                });
                            }}
                            disabled={
                                !comment.trim() || submitComment.isPending
                            }
                        >
                            <FontAwesomeIcon
                                icon={faArrowRight}
                                className="h-4 w-4"
                            />
                        </Button>
                    </div>

                    <Separator />

                    {(incident.activities ?? []).map(
                        (activity: any, i: number) => (
                            <div
                                key={activity.id}
                                className="relative flex gap-4 pl-2"
                            >
                                {i !==
                                    (incident.activities?.length ?? 0) - 1 && (
                                    <div className="absolute top-8 bottom-[-24px] left-[11px] w-px bg-border" />
                                )}
                                <div className="relative z-10 mt-1 h-2.5 w-2.5 rounded-full bg-muted-foreground ring-4 ring-background" />
                                <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-start justify-between gap-2 text-sm leading-none">
                                        <div className="flex min-w-0 items-center gap-1.5">
                                            {activity.user && (
                                                <Avatar className="h-4 w-4 shrink-0">
                                                    <AvatarImage
                                                        src={
                                                            activity.user
                                                                .image ??
                                                            undefined
                                                        }
                                                        alt={activity.user.name}
                                                    />
                                                    <AvatarFallback className="text-[8px]">
                                                        {activity.user.name
                                                            ?.slice(0, 2)
                                                            .toUpperCase() ??
                                                            "??"}
                                                    </AvatarFallback>
                                                </Avatar>
                                            )}
                                            <span className="break-words leading-5">
                                                {activity.message}
                                            </span>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger
                                                render={
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 shrink-0"
                                                    />
                                                }
                                            >
                                                <FontAwesomeIcon
                                                    icon={faEllipsis}
                                                    className="h-3 w-3"
                                                />
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onSelect={() =>
                                                        setActivityToEdit({
                                                            id: activity.id,
                                                            message:
                                                                activity.message,
                                                            createdAt:
                                                                activity.createdAt,
                                                        })
                                                    }
                                                >
                                                    <FontAwesomeIcon
                                                        icon={faPencil}
                                                        className="mr-2 h-4 w-4"
                                                    />
                                                    Edit
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <p className="text-muted-foreground text-xs">
                                        {formatDistanceToNow(
                                            new Date(activity.createdAt),
                                            {
                                                addSuffix: true,
                                            },
                                        )}
                                    </p>
                                </div>
                            </div>
                        ),
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function IncidentSidebar({
    incident,
    isMaintenance,
    isAcknowledged,
}: {
    incident: any;
    isMaintenance: boolean;
    isAcknowledged: boolean;
}) {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Details</CardTitle>
                    <CardDescription>
                        Incident metadata and status.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-1">
                        <span className="font-medium text-sm">Started at</span>
                        <span className="text-muted-foreground text-sm">
                            {format(
                                new Date(incident.startedAt),
                                "MMM d, yyyy 'at' h:mm a",
                            )}
                        </span>
                    </div>
                    <Separator />
                    {isMaintenance && (
                        <>
                            <div className="grid gap-1">
                                <span className="font-medium text-sm">
                                    Planned end
                                </span>
                                <span className="text-muted-foreground text-sm">
                                    {incident.plannedEndAt
                                        ? format(
                                              new Date(incident.plannedEndAt),
                                              "MMM d, yyyy 'at' h:mm a",
                                          )
                                        : "Not set"}
                                </span>
                            </div>
                            <Separator />
                        </>
                    )}
                    <div className="grid gap-1">
                        <span className="font-medium text-sm">Ended at</span>
                        <span className="text-muted-foreground text-sm">
                            {incident.endedAt
                                ? format(
                                      new Date(incident.endedAt),
                                      "MMM d, yyyy 'at' h:mm a",
                                  )
                                : "Ongoing"}
                        </span>
                    </div>
                    <Separator />
                    {isAcknowledged && (
                        <>
                            <div className="grid gap-1">
                                <span className="font-medium text-sm">
                                    Acknowledged by
                                </span>
                                <div className="flex items-center gap-2">
                                    <Badge
                                        variant="secondary"
                                        className="w-fit bg-zinc-800 text-zinc-400"
                                    >
                                        {incident.acknowledgedByUser?.name ||
                                            "User"}
                                    </Badge>
                                    <span className="text-muted-foreground text-xs">
                                        {incident.acknowledgedAt &&
                                            formatDistanceToNow(
                                                new Date(
                                                    incident.acknowledgedAt,
                                                ),
                                                { addSuffix: true },
                                            )}
                                    </span>
                                </div>
                            </div>
                            <Separator />
                        </>
                    )}
                    <div className="grid gap-1">
                        <span className="font-medium text-sm">Duration</span>
                        <span className="text-muted-foreground text-sm">
                            {incident.endedAt
                                ? formatDistance(
                                      new Date(incident.startedAt),
                                      new Date(incident.endedAt),
                                  )
                                : "Ongoing"}
                        </span>
                    </div>
                    <Separator />
                    <div className="grid gap-1">
                        <span className="font-medium text-sm">Severity</span>
                        <Badge variant="outline" className="w-fit">
                            {incident.severity}
                        </Badge>
                    </div>
                    <Separator />
                    <div className="grid gap-1">
                        <span className="font-medium text-sm">Type</span>
                        <span className="text-muted-foreground text-sm capitalize">
                            {incident.type}
                        </span>
                    </div>
                    <Separator />
                    <div className="grid gap-1">
                        <span className="font-medium text-sm">
                            Published on
                        </span>
                        <div className="flex flex-wrap gap-2">
                            {(incident.statusPages?.length ?? 0) > 0 ? (
                                incident.statusPages.map((item: any) => (
                                    <Badge
                                        key={item.statusPageId}
                                        variant="secondary"
                                    >
                                        {item.statusPage.name}
                                    </Badge>
                                ))
                            ) : (
                                <span className="text-muted-foreground text-sm">
                                    Internal only
                                </span>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export function IncidentDetails({ id }: { id: string }) {
    const currentTime = useCurrentTime();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [comment, setComment] = useState("");
    const [editOpen, setEditOpen] = useState(false);
    const [activityToEdit, setActivityToEdit] =
        useState<EditableActivity | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const submitComment = useMutation(
        orpc.incidents.addComment.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({
                    queryKey: orpc.incidents.get.key({ input: { id } }),
                });
                setComment("");
                sileo.success({ title: "Comment added" });
            },
            onError: (err) => {
                sileo.error({ title: `Failed to add comment: ${err.message}` });
            },
        }),
    );

    const { data: incident, isLoading } = useQuery(
        orpc.incidents.get.queryOptions({ input: { id } }),
    );

    const acknowledge = useMutation(
        orpc.incidents.acknowledge.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({
                    queryKey: orpc.incidents.get.key({ input: { id } }),
                });
                sileo.success({ title: "Incident acknowledged" });
            },
            onError: (err) => {
                sileo.error({
                    title: `Failed to acknowledge incident: ${err.message}`,
                });
            },
        }),
    );

    const resolve = useMutation(
        orpc.incidents.resolve.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({
                    queryKey: orpc.incidents.get.key({ input: { id } }),
                });
                sileo.success({ title: "Incident resolved" });
            },
            onError: (err) => {
                sileo.error({
                    title: `Failed to resolve incident: ${err.message}`,
                });
            },
        }),
    );

    const deleteIncident = useMutation(
        orpc.incidents.delete.mutationOptions({
            onSuccess: () => {
                sileo.success({ title: "Incident deleted" });
                setShowDeleteDialog(false);
                router.push("/incidents");
            },
            onError: (err) => {
                sileo.error({
                    title: `Failed to delete incident: ${err.message}`,
                });
                setShowDeleteDialog(false);
            },
        }),
    );

    const editActivity = useMutation(
        orpc.incidents.editActivity.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({
                    queryKey: orpc.incidents.get.key({ input: { id } }),
                });
                queryClient.invalidateQueries({
                    queryKey: orpc.incidents.list.key(),
                });
                setActivityToEdit(null);
                sileo.success({ title: "Timeline entry updated" });
            },
            onError: (err) => {
                sileo.error({
                    title: `Failed to update timeline entry: ${err.message}`,
                });
            },
        }),
    );

    if (isLoading) return <IncidentSkeleton />;

    if (!incident) {
        return (
            <div className="flex flex-col items-center justify-center py-10">
                <h2 className="font-bold text-xl">Incident not found</h2>
                <Button
                    className="mt-4"
                    render={<Link href="/incidents">Go back to incidents</Link>}
                />
            </div>
        );
    }

    const isResolved = incident.status === "resolved";
    const isAcknowledged = !!incident.acknowledgedAt;
    const isMaintenance = incident.severity === "maintenance";
    const isScheduledMaintenance =
        isMaintenance && new Date(incident.startedAt).getTime() > currentTime;

    return (
        <>
            <div className="mx-auto max-w-5xl space-y-6 p-6">
                <IncidentHeader
                    incident={incident}
                    id={id}
                    state={getIncidentHeaderState({
                        isResolved,
                        isAcknowledged,
                        isMaintenance,
                        isScheduledMaintenance,
                    })}
                    acknowledge={acknowledge}
                    resolve={resolve}
                    setEditOpen={setEditOpen}
                    setShowDeleteDialog={setShowDeleteDialog}
                />

                <div className="grid gap-6 md:grid-cols-3">
                    <IncidentTimeline
                        incident={incident}
                        id={id}
                        isMaintenance={isMaintenance}
                        comment={comment}
                        setComment={setComment}
                        submitComment={submitComment}
                        setActivityToEdit={setActivityToEdit}
                    />

                    <IncidentSidebar
                        incident={incident}
                        isMaintenance={isMaintenance}
                        isAcknowledged={isAcknowledged}
                    />
                </div>
            </div>

            <EditIncidentDialog
                incident={incident}
                open={editOpen}
                onOpenChange={setEditOpen}
            />

            <EditActivityDialog
                key={activityToEdit?.id ?? "no-activity"}
                activity={activityToEdit}
                open={!!activityToEdit}
                onOpenChange={(open) => {
                    if (!open) setActivityToEdit(null);
                }}
                onSubmit={(values) => {
                    if (!activityToEdit) return;
                    editActivity.mutate({
                        incidentId: id,
                        activityId: activityToEdit.id,
                        ...values,
                    });
                }}
                isPending={editActivity.isPending}
            />

            <AlertDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete incident?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently
                            delete the incident &quot;
                            {incident.title}&quot; and all of its activity
                            history.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteIncident.isPending}>
                            Cancel
                        </AlertDialogCancel>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => deleteIncident.mutate({ id })}
                            disabled={deleteIncident.isPending}
                        >
                            {deleteIncident.isPending
                                ? "Deleting..."
                                : "Delete"}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function EditActivityDialog({
    activity,
    open,
    onOpenChange,
    onSubmit,
    isPending,
}: {
    activity: EditableActivity | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: { message: string; createdAt: Date }) => void;
    isPending: boolean;
}) {
    const [message, setMessage] = useState(activity?.message ?? "");
    const [createdAt, setCreatedAt] = useState(() =>
        activity ? new Date(activity.createdAt) : new Date(),
    );

    const trimmedMessage = message.trim();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogPopup>
                <DialogHeader>
                    <DialogTitle>Edit timeline entry</DialogTitle>
                </DialogHeader>
                <DialogPanel className="space-y-4">
                    <div className="space-y-2">
                        <Label>Message</Label>
                        <Textarea
                            value={message}
                            onChange={(event) => setMessage(event.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Time</Label>
                        <DateTimePicker
                            date={createdAt}
                            setDate={(date) => setCreatedAt(date ?? createdAt)}
                        />
                    </div>
                    <DialogFooter className="-mx-6 mt-6 -mb-6">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={() =>
                                onSubmit({
                                    message: trimmedMessage,
                                    createdAt,
                                })
                            }
                            disabled={!trimmedMessage || isPending}
                        >
                            Save changes
                        </Button>
                    </DialogFooter>
                </DialogPanel>
            </DialogPopup>
        </Dialog>
    );
}

function useEditIncidentDialogModel({
    incident,
    open,
    onOpenChange,
}: {
    incident: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const queryClient = useQueryClient();

    const form = useForm<EditIncidentValues>({
        resolver: zodResolver(editIncidentSchema),
        defaultValues: {
            title: incident.title,
            description: incident.description ?? "",
            severity: incident.severity as EditIncidentValues["severity"],
            startedAt: new Date(incident.startedAt),
            plannedEndAt: incident.plannedEndAt
                ? new Date(incident.plannedEndAt)
                : null,
            endedAt: incident.endedAt ? new Date(incident.endedAt) : null,
            monitorIds: (incident.monitors ?? []).map(
                (item: any) => item.monitor.id,
            ),
            statusPageIds: (incident.statusPages ?? []).map(
                (item: any) => item.statusPageId,
            ),
        },
    });

    useEffect(() => {
        form.reset({
            title: incident.title,
            description: incident.description ?? "",
            severity: incident.severity as EditIncidentValues["severity"],
            startedAt: new Date(incident.startedAt),
            plannedEndAt: incident.plannedEndAt
                ? new Date(incident.plannedEndAt)
                : null,
            endedAt: incident.endedAt ? new Date(incident.endedAt) : null,
            monitorIds: (incident.monitors ?? []).map(
                (item: any) => item.monitor.id,
            ),
            statusPageIds: (incident.statusPages ?? []).map(
                (item: any) => item.statusPageId,
            ),
        });
    }, [form, incident]);

    const { data: monitorsData } = useQuery(
        orpc.monitors.list.queryOptions({ input: { limit: 100 } }),
    );
    const { data: statusPagesData } = useQuery(
        orpc.statusPages.list.queryOptions({ input: { limit: 100 } }),
    );
    const monitorIds = useWatch({ control: form.control, name: "monitorIds" });
    const severity = useWatch({ control: form.control, name: "severity" });
    const statusPageIds = useWatch({
        control: form.control,
        name: "statusPageIds",
    });
    const selectedMonitorIdSet = new Set(monitorIds);
    const selectedMonitors =
        monitorsData?.items.filter((item: any) =>
            selectedMonitorIdSet.has(item.id),
        ) ?? [];

    const updateIncident = useMutation(
        orpc.incidents.update.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({
                    queryKey: orpc.incidents.get.key({
                        input: { id: incident.id },
                    }),
                });
                queryClient.invalidateQueries({
                    queryKey: orpc.incidents.list.key(),
                });
                sileo.success({ title: "Incident updated" });
                onOpenChange(false);
            },
            onError: (error) => {
                sileo.error({
                    title: `Failed to update incident: ${error.message}`,
                });
            },
        }),
    );

    return {
        incident,
        open,
        onOpenChange,
        queryClient,
        form,
        monitorsData,
        statusPagesData,
        monitorIds,
        severity,
        statusPageIds,
        selectedMonitorIdSet,
        selectedMonitors,
        updateIncident,
    };
}

type EditIncidentDialogModel = ReturnType<typeof useEditIncidentDialogModel>;

function EditIncidentDialogContentSection6({
    model,
}: {
    model: EditIncidentDialogModel;
}) {
    const {
        incident,
        open,
        onOpenChange,
        queryClient,
        form,
        monitorsData,
        statusPagesData,
        monitorIds,
        severity,
        statusPageIds,
        selectedMonitorIdSet,
        selectedMonitors,
        updateIncident,
    } = model;
    return (
        <div className="grid gap-4 md:grid-cols-2">
            <FormField
                control={form.control}
                name="startedAt"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Started at</FormLabel>
                        <FormControl>
                            <DateTimePicker
                                date={field.value}
                                setDate={(date) =>
                                    field.onChange(date ?? new Date())
                                }
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="endedAt"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Ended at</FormLabel>
                        <div className="space-y-2">
                            <FormControl>
                                <DateTimePicker
                                    date={field.value ?? undefined}
                                    setDate={(date) =>
                                        field.onChange(date ?? null)
                                    }
                                />
                            </FormControl>
                            {field.value && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="px-0"
                                    onClick={() => field.onChange(null)}
                                >
                                    Clear end time
                                </Button>
                            )}
                        </div>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}

function EditIncidentDialogContentSection5({
    model,
}: {
    model: EditIncidentDialogModel;
}) {
    const {
        incident,
        open,
        onOpenChange,
        queryClient,
        form,
        monitorsData,
        statusPagesData,
        monitorIds,
        severity,
        statusPageIds,
        selectedMonitorIdSet,
        selectedMonitors,
        updateIncident,
    } = model;
    return (
        <div className="space-y-4">
            <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                            <Input {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                            <Textarea {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <EditIncidentDialogContentSection6 model={model} />

            <FormField
                control={form.control}
                name="severity"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Severity</FormLabel>
                        <div className="flex gap-2">
                            {(
                                [
                                    "minor",
                                    "major",
                                    "critical",
                                    "maintenance",
                                ] as const
                            ).map((value) => (
                                <Button
                                    key={value}
                                    type="button"
                                    variant={
                                        field.value === value
                                            ? "default"
                                            : "outline"
                                    }
                                    onClick={() => field.onChange(value)}
                                    className="capitalize"
                                >
                                    {value}
                                </Button>
                            ))}
                        </div>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {severity === "maintenance" && (
                <FormField
                    control={form.control}
                    name="plannedEndAt"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Planned end</FormLabel>
                            <div className="space-y-2">
                                <FormControl>
                                    <DateTimePicker
                                        date={field.value ?? undefined}
                                        setDate={(date) =>
                                            field.onChange(date ?? null)
                                        }
                                    />
                                </FormControl>
                                {field.value && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="px-0"
                                        onClick={() => field.onChange(null)}
                                    >
                                        Clear planned end
                                    </Button>
                                )}
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}

            <div className="space-y-3">
                <FormLabel>Affected monitors</FormLabel>
                <GroupedMonitorCombobox
                    ariaLabel="Affected monitors"
                    monitors={monitorsData?.items ?? []}
                    value={selectedMonitors}
                    onValueChange={(values) =>
                        form.setValue(
                            "monitorIds",
                            values.map((item) => item.id),
                            {
                                shouldDirty: true,
                                shouldValidate: true,
                            },
                        )
                    }
                    placeholder="No monitors selected. The incident will be global."
                />
            </div>

            <MultiSelectField
                label="Publish to status pages"
                values={statusPageIds ?? []}
                options={
                    statusPagesData?.items.map((item: any) => ({
                        id: item.id,
                        label: item.name,
                    })) ?? []
                }
                onChange={(values) =>
                    form.setValue("statusPageIds", values, {
                        shouldDirty: true,
                        shouldValidate: true,
                    })
                }
                emptyLabel="Internal only"
                searchPlaceholder="Search status pages..."
            />
        </div>
    );
}

function EditIncidentDialogDialog4({
    model,
}: {
    model: EditIncidentDialogModel;
}) {
    const {
        incident,
        open,
        onOpenChange,
        queryClient,
        form,
        monitorsData,
        statusPagesData,
        monitorIds,
        severity,
        statusPageIds,
        selectedMonitorIdSet,
        selectedMonitors,
        updateIncident,
    } = model;
    return (
        <DialogPanel className="">
            <EditIncidentDialogContentSection5 model={model} />
            <DialogFooter className="-mx-6 mt-6 -mb-6">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                >
                    Cancel
                </Button>
                <Button type="submit" disabled={updateIncident.isPending}>
                    Save changes
                </Button>
            </DialogFooter>
        </DialogPanel>
    );
}

function EditIncidentDialogFormSection3({
    model,
}: {
    model: EditIncidentDialogModel;
}) {
    const {
        incident,
        open,
        onOpenChange,
        queryClient,
        form,
        monitorsData,
        statusPagesData,
        monitorIds,
        severity,
        statusPageIds,
        selectedMonitorIdSet,
        selectedMonitors,
        updateIncident,
    } = model;
    return (
        <form
            onSubmit={form.handleSubmit((values) =>
                updateIncident.mutate({
                    id: incident.id,
                    title: values.title,
                    description: values.description || undefined,
                    severity: values.severity,
                    startedAt: values.startedAt,
                    plannedEndAt: values.plannedEndAt,
                    endedAt: values.endedAt,
                    monitorIds: values.monitorIds,
                    statusPageIds: values.statusPageIds,
                }),
            )}
        >
            <EditIncidentDialogDialog4 model={model} />
        </form>
    );
}

function EditIncidentDialogFormSection2({
    model,
}: {
    model: EditIncidentDialogModel;
}) {
    const {
        incident,
        open,
        onOpenChange,
        queryClient,
        form,
        monitorsData,
        statusPagesData,
        monitorIds,
        severity,
        statusPageIds,
        selectedMonitorIdSet,
        selectedMonitors,
        updateIncident,
    } = model;
    return (
        <Form {...form}>
            <EditIncidentDialogFormSection3 model={model} />
        </Form>
    );
}

function EditIncidentDialogDialog1({
    model,
}: {
    model: EditIncidentDialogModel;
}) {
    const {
        incident,
        open,
        onOpenChange,
        queryClient,
        form,
        monitorsData,
        statusPagesData,
        monitorIds,
        severity,
        statusPageIds,
        selectedMonitorIdSet,
        selectedMonitors,
        updateIncident,
    } = model;
    return (
        <DialogPopup className="sm:max-w-[720px]">
            <DialogHeader>
                <DialogTitle>Edit incident</DialogTitle>
            </DialogHeader>

            <EditIncidentDialogFormSection2 model={model} />
        </DialogPopup>
    );
}
function EditIncidentDialogView({ model }: { model: EditIncidentDialogModel }) {
    const {
        incident,
        open,
        onOpenChange,
        queryClient,
        form,
        monitorsData,
        statusPagesData,
        monitorIds,
        severity,
        statusPageIds,
        selectedMonitorIdSet,
        selectedMonitors,
        updateIncident,
    } = model;
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <EditIncidentDialogDialog1 model={model} />
        </Dialog>
    );
}

function EditIncidentDialog({
    incident,
    open,
    onOpenChange,
}: {
    incident: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const model = useEditIncidentDialogModel({ incident, open, onOpenChange });
    return <EditIncidentDialogView model={model} />;
}

function MultiSelectField({
    label,
    values,
    options,
    onChange,
    emptyLabel,
    searchPlaceholder,
}: {
    label: string;
    values: string[];
    options: { id: string; label: string }[];
    onChange: (values: string[]) => void;
    emptyLabel: string;
    searchPlaceholder: string;
}) {
    const selectedValueSet = new Set(values);
    const selectedItems = options.filter((option) =>
        selectedValueSet.has(option.id),
    );

    return (
        <div className="space-y-3">
            <FormLabel>{label}</FormLabel>

            <Combobox
                items={options}
                value={selectedItems}
                onValueChange={(newValue) => {
                    onChange(newValue.map((item) => item.id));
                }}
                multiple
            >
                <ComboboxChips>
                    <ComboboxValue>
                        {(value: { id: string; label: string }[]) => (
                            <>
                                {value?.map((item) => (
                                    <ComboboxChip
                                        aria-label={item.label}
                                        key={item.id}
                                    >
                                        {item.label}
                                    </ComboboxChip>
                                ))}
                                <ComboboxChipsInput
                                    aria-label={label}
                                    placeholder={
                                        value.length > 0
                                            ? searchPlaceholder
                                            : emptyLabel
                                    }
                                />
                            </>
                        )}
                    </ComboboxValue>
                </ComboboxChips>
                <ComboboxPopup>
                    <ComboboxEmpty>No items found.</ComboboxEmpty>
                    <ComboboxList>
                        {(item) => (
                            <ComboboxItem key={item.id} value={item}>
                                {item.label}
                            </ComboboxItem>
                        )}
                    </ComboboxList>
                </ComboboxPopup>
            </Combobox>
        </div>
    );
}

function IncidentSkeleton() {
    return (
        <div className="mx-auto max-w-5xl p-6">
            <Skeleton className="mb-6 h-20 w-full" />
            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2">
                    <Skeleton className="mb-6 h-40" />
                    <Skeleton className="h-60" />
                </div>
                <div>
                    <Skeleton className="h-60" />
                </div>
            </div>
        </div>
    );
}
