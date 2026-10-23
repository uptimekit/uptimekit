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

type IncidentState = {
    isResolved: boolean;
    isAcknowledged: boolean;
    isMaintenance: boolean;
    isScheduledMaintenance: boolean;
};

type StatusBadge = {
    label: string;
    variant: "success" | "info" | "warning" | "error";
};

const DATE_FORMAT = "MMM d, yyyy 'at' h:mm a";

function getStatusBadge({
    isResolved,
    isAcknowledged,
    isMaintenance,
    isScheduledMaintenance,
}: IncidentState): StatusBadge {
    if (isMaintenance) {
        if (isResolved) return { label: "Completed", variant: "success" };
        return {
            label: isScheduledMaintenance ? "Scheduled" : "In progress",
            variant: "info",
        };
    }
    if (isResolved) return { label: "Resolved", variant: "success" };
    return isAcknowledged
        ? { label: "Acknowledged", variant: "warning" }
        : { label: "Ongoing", variant: "error" };
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
    state: IncidentState;
    acknowledge: {
        mutate: (input: { id: string }) => void;
        isPending: boolean;
    };
    resolve: { mutate: (input: { id: string }) => void; isPending: boolean };
    setEditOpen: (open: boolean) => void;
    setShowDeleteDialog: (open: boolean) => void;
}) {
    const { isResolved, isAcknowledged, isMaintenance } = state;
    const status = getStatusBadge(state);

    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <div
                    className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-lg border sm:size-12 sm:rounded-xl",
                        isMaintenance
                            ? "border-blue-500/20 bg-blue-500/10 text-blue-500"
                            : isResolved
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                              : "border-red-500/20 bg-red-500/10 text-red-500",
                    )}
                >
                    <FontAwesomeIcon
                        icon={
                            isMaintenance
                                ? faWrench
                                : isResolved
                                  ? faCircleCheck
                                  : faShieldHalved
                        }
                        className="size-5 sm:size-6"
                    />
                </div>

                <div className="min-w-0 space-y-2">
                    <h1 className="break-words font-semibold text-xl leading-tight tracking-tight sm:text-2xl">
                        {incident.title}
                    </h1>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={status.variant} size="lg">
                            {status.label}
                        </Badge>
                        {!isMaintenance && (
                            <Badge
                                variant="outline"
                                size="lg"
                                className="capitalize"
                            >
                                {incident.severity}
                            </Badge>
                        )}
                        <Badge
                            variant="outline"
                            size="lg"
                            className="capitalize"
                        >
                            {incident.type}
                        </Badge>
                    </div>
                </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
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
                        <FontAwesomeIcon icon={faCircleCheck} />
                        Resolve
                    </Button>
                )}
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                    <FontAwesomeIcon icon={faPencil} />
                    Edit
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="More actions"
                            />
                        }
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
    );
}

function getDurationLabel(
    startedAt: Date,
    endedAt: Date | null,
    currentTime: number,
) {
    if (endedAt) return formatDistance(startedAt, endedAt);
    // currentTime is 0 during SSR, and scheduled maintenance has not started yet
    if (currentTime <= startedAt.getTime()) return "—";
    return `${formatDistance(startedAt, currentTime)} so far`;
}

function IncidentStats({
    incident,
    isMaintenance,
    currentTime,
}: {
    incident: any;
    isMaintenance: boolean;
    currentTime: number;
}) {
    const startedAt = new Date(incident.startedAt);
    const endedAt = incident.endedAt ? new Date(incident.endedAt) : null;
    const showPlannedEnd = isMaintenance && !endedAt;

    const stats = [
        { label: "Started", value: format(startedAt, DATE_FORMAT) },
        showPlannedEnd
            ? {
                  label: "Planned end",
                  value: incident.plannedEndAt
                      ? format(new Date(incident.plannedEndAt), DATE_FORMAT)
                      : "Not set",
              }
            : {
                  label: "Ended",
                  value: endedAt ? format(endedAt, DATE_FORMAT) : "Ongoing",
              },
        {
            label: "Duration",
            value: getDurationLabel(startedAt, endedAt, currentTime),
        },
        {
            label: "Acknowledged",
            value: incident.acknowledgedAt
                ? `${incident.acknowledgedByUser?.name ?? "User"} · ${formatDistanceToNow(new Date(incident.acknowledgedAt), { addSuffix: true })}`
                : "Not yet",
        },
    ];

    return (
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
            {stats.map((stat) => (
                <div key={stat.label} className="min-w-0 bg-card p-4">
                    <dt className="text-muted-foreground text-xs">
                        {stat.label}
                    </dt>
                    <dd className="mt-1 break-words font-medium text-sm">
                        {stat.value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

function IncidentDescription({ incident }: { incident: any }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
                <p
                    className={cn(
                        "whitespace-pre-wrap break-words text-sm leading-relaxed",
                        !incident.description && "text-muted-foreground",
                    )}
                >
                    {incident.description || "No description provided."}
                </p>
            </CardContent>
        </Card>
    );
}

function TimelineEntry({
    activity,
    setActivityToEdit,
    setActivityToDelete,
}: {
    activity: any;
    setActivityToEdit: (activity: EditableActivity | null) => void;
    setActivityToDelete: (activity: EditableActivity | null) => void;
}) {
    const createdAt = new Date(activity.createdAt);
    const editable: EditableActivity = {
        id: activity.id,
        message: activity.message,
        createdAt: activity.createdAt,
    };

    return (
        <li className="relative flex gap-3">
            <div className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border bg-card">
                {activity.user ? (
                    <Avatar className="size-6">
                        <AvatarImage
                            src={activity.user.image ?? undefined}
                            alt={activity.user.name}
                        />
                        <AvatarFallback className="text-[9px]">
                            {activity.user.name?.slice(0, 2).toUpperCase() ??
                                "??"}
                        </AvatarFallback>
                    </Avatar>
                ) : (
                    <span className="size-2 rounded-full bg-muted-foreground" />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex h-6 items-center justify-between gap-2">
                    <p className="truncate text-muted-foreground text-xs">
                        <span className="font-medium text-foreground">
                            {activity.user?.name ?? "System"}
                        </span>
                        {" · "}
                        <time
                            dateTime={createdAt.toISOString()}
                            title={format(createdAt, DATE_FORMAT)}
                        >
                            {formatDistanceToNow(createdAt, {
                                addSuffix: true,
                            })}
                        </time>
                    </p>
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0"
                                    aria-label="Entry actions"
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
                                onSelect={() => setActivityToEdit(editable)}
                            >
                                <FontAwesomeIcon
                                    icon={faPencil}
                                    className="mr-2 h-4 w-4"
                                />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-red-500"
                                onSelect={() => setActivityToDelete(editable)}
                            >
                                <FontAwesomeIcon
                                    icon={faTrash}
                                    className="mr-2 h-4 w-4"
                                />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {activity.message}
                </p>
            </div>
        </li>
    );
}

function IncidentTimeline({
    incident,
    id,
    comment,
    setComment,
    submitComment,
    setActivityToEdit,
    setActivityToDelete,
}: {
    incident: any;
    id: string;
    comment: string;
    setComment: (comment: string) => void;
    submitComment: {
        mutate: (input: { incidentId: string; message: string }) => void;
        isPending: boolean;
    };
    setActivityToEdit: (activity: EditableActivity | null) => void;
    setActivityToDelete: (activity: EditableActivity | null) => void;
}) {
    const activities = incident.activities ?? [];
    const trimmedComment = comment.trim();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!trimmedComment || submitComment.isPending) return;
                        submitComment.mutate({
                            incidentId: id,
                            message: trimmedComment,
                        });
                    }}
                >
                    <Input
                        aria-label="Add a comment"
                        placeholder="Add a comment..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                    />
                    <Button
                        type="submit"
                        size="icon"
                        variant="outline"
                        aria-label="Post comment"
                        disabled={!trimmedComment || submitComment.isPending}
                    >
                        <FontAwesomeIcon
                            icon={faArrowRight}
                            className="h-4 w-4"
                        />
                    </Button>
                </form>

                {activities.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                        No activity yet.
                    </p>
                ) : (
                    <ol className="relative space-y-5 before:absolute before:top-3 before:bottom-3 before:left-3 before:w-px before:bg-border">
                        {activities.map((activity: any) => (
                            <TimelineEntry
                                key={activity.id}
                                activity={activity}
                                setActivityToEdit={setActivityToEdit}
                                setActivityToDelete={setActivityToDelete}
                            />
                        ))}
                    </ol>
                )}
            </CardContent>
        </Card>
    );
}

function IncidentSidebar({ incident }: { incident: any }) {
    const monitors = incident.monitors ?? [];
    const statusPages = incident.statusPages ?? [];

    return (
        <Card>
            <CardContent className="space-y-5 pt-6">
                <section className="space-y-2">
                    <h3 className="font-medium text-muted-foreground text-xs">
                        Affected monitors
                    </h3>
                    {monitors.length > 0 ? (
                        <ul className="-mx-2 space-y-0.5">
                            {monitors.map((m: any) => (
                                <li key={m.monitor.id}>
                                    <Link
                                        href={`/monitors/${m.monitor.id}`}
                                        className="block truncate rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                                    >
                                        {m.monitor.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground text-sm">
                            None, global incident
                        </p>
                    )}
                </section>
                <Separator />
                <section className="space-y-2">
                    <h3 className="font-medium text-muted-foreground text-xs">
                        Published on
                    </h3>
                    {statusPages.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {statusPages.map((item: any) => (
                                <Badge
                                    key={item.statusPageId}
                                    variant="secondary"
                                >
                                    {item.statusPage.name}
                                </Badge>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-sm">
                            Internal only
                        </p>
                    )}
                </section>
            </CardContent>
        </Card>
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
    const [activityToDelete, setActivityToDelete] =
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

    const deleteActivity = useMutation(
        orpc.incidents.deleteActivity.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({
                    queryKey: orpc.incidents.get.key({ input: { id } }),
                });
                queryClient.invalidateQueries({
                    queryKey: orpc.incidents.list.key(),
                });
                setActivityToDelete(null);
                sileo.success({ title: "Timeline entry deleted" });
            },
            onError: (err) => {
                sileo.error({
                    title: `Failed to delete timeline entry: ${err.message}`,
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
            <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
                <IncidentHeader
                    incident={incident}
                    id={id}
                    state={{
                        isResolved,
                        isAcknowledged,
                        isMaintenance,
                        isScheduledMaintenance,
                    }}
                    acknowledge={acknowledge}
                    resolve={resolve}
                    setEditOpen={setEditOpen}
                    setShowDeleteDialog={setShowDeleteDialog}
                />

                <IncidentStats
                    incident={incident}
                    isMaintenance={isMaintenance}
                    currentTime={currentTime}
                />

                {/* Sidebar sits between description and timeline in DOM so it isn't buried under a long timeline on mobile */}
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:grid-rows-[auto_1fr]">
                    <IncidentDescription incident={incident} />
                    <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
                        <IncidentSidebar incident={incident} />
                    </div>
                    <IncidentTimeline
                        incident={incident}
                        id={id}
                        comment={comment}
                        setComment={setComment}
                        submitComment={submitComment}
                        setActivityToEdit={setActivityToEdit}
                        setActivityToDelete={setActivityToDelete}
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
                open={!!activityToDelete}
                onOpenChange={(open) => {
                    if (!open) setActivityToDelete(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete timeline entry?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently
                            delete the timeline entry &quot;
                            {activityToDelete?.message}&quot;.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteActivity.isPending}>
                            Cancel
                        </AlertDialogCancel>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => {
                                if (!activityToDelete) return;
                                deleteActivity.mutate({
                                    incidentId: id,
                                    activityId: activityToDelete.id,
                                });
                            }}
                            disabled={deleteActivity.isPending}
                        >
                            {deleteActivity.isPending
                                ? "Deleting..."
                                : "Delete"}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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
        <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3 sm:gap-4">
                    <Skeleton className="size-10 shrink-0 rounded-lg sm:size-12 sm:rounded-xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-7 w-56 sm:h-8 sm:w-80" />
                        <div className="flex gap-1.5">
                            <Skeleton className="h-5.5 w-16" />
                            <Skeleton className="h-5.5 w-14" />
                            <Skeleton className="h-5.5 w-20" />
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-28" />
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="size-9" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
                {["started", "ended", "duration", "acknowledged"].map(
                    (stat) => (
                        <div key={stat} className="space-y-2 bg-card p-4">
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className="h-4 w-32 max-w-full" />
                        </div>
                    ),
                )}
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:grid-rows-[auto_1fr]">
                <Skeleton className="h-36 rounded-xl" />
                <Skeleton className="h-44 rounded-xl lg:col-start-2 lg:row-span-2 lg:row-start-1" />
                <Skeleton className="h-96 rounded-xl" />
            </div>
        </div>
    );
}
