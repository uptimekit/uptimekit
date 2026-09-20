"use client";

import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type * as React from "react";
import { useState } from "react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { client, orpc } from "@/utils/orpc";
import { importSourceForms } from "./connection-forms";

type PreviewResult = Awaited<ReturnType<typeof client.imports.preview>>;
type PreviewMonitor = PreviewResult["supported"][number];

type Step = "connect" | "review" | "done";

const DEFAULT_SOURCE_ID = "uptime-kuma";

function toggle(set: Set<string>, id: string) {
    const next = new Set(set);
    if (next.has(id)) {
        next.delete(id);
    } else {
        next.add(id);
    }
    return next;
}

function useImportWizardState() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [step, setStep] = useState<Step>("connect");
    const [sourceId, setSourceId] = useState(DEFAULT_SOURCE_ID);
    const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
    const [organizationId, setOrganizationId] = useState("");
    const [connection, setConnection] = useState<Record<string, unknown>>(
        () => importSourceForms[DEFAULT_SOURCE_ID]?.emptyValues ?? {},
    );

    const [preview, setPreview] = useState<PreviewResult | null>(null);
    const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(
        new Set(),
    );
    const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<string>>(
        new Set(),
    );
    const [selectedNotificationIds, setSelectedNotificationIds] = useState<
        Set<string>
    >(new Set());
    const [result, setResult] = useState<Awaited<
        ReturnType<typeof client.imports.commit>
    > | null>(null);

    const { data: sources } = useQuery(orpc.imports.listSources.queryOptions());
    const { data: orgs } = useQuery(
        orpc.organizations.list.queryOptions({ input: { limit: 100 } }),
    );
    const { data: workers } = useQuery(orpc.workers.listActive.queryOptions());

    const sourceForm = importSourceForms[sourceId];

    const previewMutation = useMutation({
        mutationFn: async () => {
            if (!sourceForm) throw new Error("Unknown import source");
            return client.imports.preview({
                sourceId,
                organizationId,
                connection: sourceForm.toConnection(connection),
            });
        },
        onSuccess: (data) => {
            setPreview(data);
            setSelectedSourceIds(
                new Set(data.supported.map((m) => m.sourceId)),
            );
            setStep("review");
        },
        onError: (error: Error) =>
            sileo.error({ title: error.message || "Failed to connect" }),
    });

    const commitMutation = useMutation({
        mutationFn: async () => {
            if (!preview) throw new Error("No preview");
            const monitors = preview.supported.filter((m) =>
                selectedSourceIds.has(m.sourceId),
            );
            return client.imports.commit({
                organizationId,
                workerIds: [...selectedWorkerIds],
                notificationIds: [...selectedNotificationIds],
                monitors,
                groups: preview.groups,
                tags: preview.tags,
            });
        },
        onSuccess: (data) => {
            void Promise.all([
                queryClient.invalidateQueries({
                    queryKey: orpc.monitors.list.key(),
                }),
                queryClient.invalidateQueries({
                    queryKey: orpc.monitors.listGroups.key(),
                }),
                queryClient.invalidateQueries({
                    queryKey: orpc.monitors.listTags.key(),
                }),
            ]);
            setResult(data);
            setStep("done");
        },
        onError: (error: Error) =>
            sileo.error({ title: error.message || "Import failed" }),
    });

    const selectedMonitors = (preview?.supported ?? []).filter((monitor) =>
        selectedSourceIds.has(monitor.sourceId),
    );
    const warned = selectedMonitors.filter(
        (m) => (m.warnings?.length ?? 0) > 0,
    );

    const exceedsQuota =
        preview !== null &&
        preview.quota.remaining !== null &&
        selectedMonitors.length > preview.quota.remaining;

    const canPreview = Boolean(
        organizationId && sourceForm?.isComplete(connection),
    );
    const canCommit = selectedMonitors.length > 0 && !exceedsQuota;

    const orgItems = (orgs?.items ?? []) as { id: string; name: string }[];
    const selectedOrgName = orgItems.find((o) => o.id === organizationId)?.name;

    const sourceItems = (sources ?? []) as {
        id: string;
        label: string;
        description: string;
    }[];
    const selectedSource = sourceItems.find((s) => s.id === sourceId);

    return {
        router,
        step,
        setStep,
        sourceId,
        setSourceId,
        sourceDialogOpen,
        setSourceDialogOpen,
        organizationId,
        setOrganizationId,
        connection,
        setConnection,
        preview,
        selectedSourceIds,
        setSelectedSourceIds,
        selectedWorkerIds,
        setSelectedWorkerIds,
        selectedNotificationIds,
        setSelectedNotificationIds,
        result,
        sources,
        orgs,
        workers,
        sourceForm,
        previewMutation,
        commitMutation,
        selectedMonitors,
        warned,
        canPreview,
        canCommit,
        orgItems,
        selectedOrgName,
        sourceItems,
        selectedSource,
    };
}

export function ImportWizard() {
    const state = useImportWizardState();

    if (state.step === "connect") {
        return <ConnectStep state={state} />;
    }

    if (state.step === "review" && state.preview) {
        return <ReviewStep state={state} />;
    }

    if (state.step === "done" && state.result) {
        return <ImportComplete state={state} />;
    }

    return null;
}

type ImportWizardState = ReturnType<typeof useImportWizardState>;

function ImportPageShell({
    actions,
    children,
}: {
    actions?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="mx-auto w-full max-w-6xl space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="font-bold text-2xl tracking-tight">
                        Import monitors
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Import monitors from another monitoring tool into an
                        organization.
                    </p>
                </div>
                {actions && (
                    <div className="flex flex-wrap items-center gap-2">
                        {actions}
                    </div>
                )}
            </div>
            {children}
        </div>
    );
}

function ImportPanel({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex min-h-12 items-center gap-2 border-b bg-muted/20 px-4 py-3 font-medium text-muted-foreground text-sm">
                <FontAwesomeIcon icon={faChevronDown} className="h-4 w-4" />
                {title}
            </div>
            {children}
        </div>
    );
}

function ConnectStep({ state }: { state: ImportWizardState }) {
    const {
        sourceId,
        setSourceId,
        sourceDialogOpen,
        setSourceDialogOpen,
        organizationId,
        setOrganizationId,
        connection,
        setConnection,
        sourceForm,
        previewMutation,
        canPreview,
        orgItems,
        selectedOrgName,
        sourceItems,
        selectedSource,
    } = state;

    return (
        <ImportPageShell
            actions={
                <Button
                    disabled={!canPreview || previewMutation.isPending}
                    onClick={() => previewMutation.mutate()}
                >
                    {previewMutation.isPending
                        ? "Connecting…"
                        : "Connect & preview"}
                </Button>
            }
        >
            <ImportPanel title="Connection">
                <div className="space-y-4 p-4">
                    <div className="space-y-2">
                        <Label>Import from</Label>
                        <button
                            type="button"
                            onClick={() => setSourceDialogOpen(true)}
                            className="flex w-full items-center gap-3 rounded-lg border bg-background p-4 text-left transition-colors hover:bg-muted/50"
                        >
                            <div className="min-w-0">
                                <p className="truncate font-medium text-sm">
                                    {selectedSource?.label ??
                                        "Choose a source…"}
                                </p>
                                {selectedSource && (
                                    <p className="line-clamp-2 text-muted-foreground text-sm">
                                        {selectedSource.description}
                                    </p>
                                )}
                            </div>
                            <span className="ml-auto shrink-0 text-muted-foreground text-xs">
                                Change
                            </span>
                        </button>
                    </div>
                    <div className="space-y-2">
                        <Label>Target organization</Label>
                        <Select
                            value={organizationId}
                            onValueChange={(value) =>
                                setOrganizationId(value as string)
                            }
                        >
                            <SelectTrigger>
                                <SelectValue>
                                    {selectedOrgName ??
                                        "Select an organization"}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent alignItemWithTrigger={false}>
                                {orgItems.map((org) => (
                                    <SelectItem key={org.id} value={org.id}>
                                        {org.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {sourceForm && (
                        <sourceForm.Form
                            values={connection}
                            onChange={setConnection}
                        />
                    )}
                </div>
            </ImportPanel>

            <Dialog open={sourceDialogOpen} onOpenChange={setSourceDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Choose import source</DialogTitle>
                        <DialogDescription>
                            Select where you want to import monitors from.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogPanel className="grid gap-3 sm:grid-cols-2">
                        {sourceItems.length === 0 ? (
                            <div className="col-span-full flex h-24 items-center justify-center text-muted-foreground text-sm">
                                No sources available.
                            </div>
                        ) : (
                            sourceItems.map((source) => (
                                <button
                                    key={source.id}
                                    type="button"
                                    className={`flex min-w-0 items-start gap-3 rounded-lg border bg-background p-4 text-left transition-colors hover:bg-muted/50 ${
                                        source.id === sourceId
                                            ? "border-primary"
                                            : ""
                                    }`}
                                    onClick={() => {
                                        setSourceId(source.id);
                                        setConnection(
                                            importSourceForms[source.id]
                                                ?.emptyValues ?? {},
                                        );
                                        setSourceDialogOpen(false);
                                    }}
                                >
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-sm">
                                            {source.label}
                                        </p>
                                        <p className="line-clamp-2 text-muted-foreground text-sm">
                                            {source.description}
                                        </p>
                                    </div>
                                </button>
                            ))
                        )}
                    </DialogPanel>
                </DialogContent>
            </Dialog>
        </ImportPageShell>
    );
}

function ReviewStep({ state }: { state: ImportWizardState }) {
    const {
        setStep,
        preview,
        selectedSourceIds,
        setSelectedSourceIds,
        selectedWorkerIds,
        setSelectedWorkerIds,
        selectedNotificationIds,
        setSelectedNotificationIds,
        workers,
        commitMutation,
        selectedMonitors,
        canCommit,
    } = state;

    if (!preview) return null;

    const exceedsQuota =
        preview.quota.remaining !== null &&
        selectedMonitors.length > preview.quota.remaining;

    return (
        <ImportPageShell
            actions={
                <>
                    <Button
                        variant="ghost"
                        onClick={() => setStep("connect")}
                        disabled={commitMutation.isPending}
                    >
                        Back
                    </Button>
                    <Button
                        disabled={!canCommit || commitMutation.isPending}
                        onClick={() => commitMutation.mutate()}
                    >
                        {commitMutation.isPending
                            ? "Importing…"
                            : `Import ${selectedMonitors.length} monitor(s)`}
                    </Button>
                </>
            }
        >
            <ImportPanel title="Import options">
                <div className="space-y-4 p-4">
                    <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                        Quota: {preview.quota.used} used /{" "}
                        {preview.quota.limit ?? "Unlimited"}
                        {exceedsQuota && (
                            <span className="ml-2 text-destructive">
                                Selection exceeds remaining (
                                {preview.quota.remaining}).
                            </span>
                        )}
                    </div>

                    <p className="text-muted-foreground text-xs">
                        Importing isn't idempotent — running it again creates
                        duplicate monitors and groups (tags are matched by
                        name).
                    </p>

                    <div className="space-y-2">
                        <Label>
                            Workers (optional — applied to all imported
                            monitors)
                        </Label>
                        <div className="flex flex-wrap gap-3">
                            {(workers ?? []).map((w) => (
                                <div
                                    key={w.id}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <Checkbox
                                        checked={selectedWorkerIds.has(w.id)}
                                        onCheckedChange={() =>
                                            setSelectedWorkerIds((s) =>
                                                toggle(s, w.id),
                                            )
                                        }
                                    />
                                    {w.name} ({w.location})
                                </div>
                            ))}
                            {(workers ?? []).length === 0 && (
                                <p className="text-muted-foreground text-sm">
                                    No active workers available.
                                </p>
                            )}
                        </div>
                        {selectedWorkerIds.size === 0 && (
                            <p className="text-muted-foreground text-xs">
                                No workers selected — monitors will be imported
                                but stay pending until you assign workers to
                                them.
                            </p>
                        )}
                    </div>

                    {preview.availableNotifications.length > 0 && (
                        <div className="space-y-2">
                            <Label>
                                Notifications (applied to all imported monitors)
                            </Label>
                            <div className="flex flex-wrap gap-3">
                                {preview.availableNotifications.map((n) => (
                                    <div
                                        key={n.id}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <Checkbox
                                            checked={selectedNotificationIds.has(
                                                n.id,
                                            )}
                                            onCheckedChange={() =>
                                                setSelectedNotificationIds(
                                                    (s) => toggle(s, n.id),
                                                )
                                            }
                                        />
                                        {n.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </ImportPanel>

            <ImportPanel
                title={`Monitors (${selectedMonitors.length}/${preview.supported.length} selected)`}
            >
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-10 pl-6" />
                            <TableHead>Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Tags</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {preview.supported.map((m: PreviewMonitor) => (
                            <TableRow
                                key={m.sourceId}
                                className="hover:bg-muted/40"
                            >
                                <TableCell className="w-10 pl-6">
                                    <Checkbox
                                        checked={selectedSourceIds.has(
                                            m.sourceId,
                                        )}
                                        onCheckedChange={() =>
                                            setSelectedSourceIds((s) =>
                                                toggle(s, m.sourceId),
                                            )
                                        }
                                    />
                                </TableCell>
                                <TableCell className="font-medium">
                                    {m.name}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {m.type}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {m.tagNames.join(", ")}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {preview.skipped.length > 0 && (
                    <div className="border-t bg-muted/20 px-4 py-3">
                        <details className="text-sm">
                            <summary className="cursor-pointer text-muted-foreground">
                                {preview.skipped.length} monitor(s) skipped
                            </summary>
                            <ul className="mt-2 list-disc pl-6 text-muted-foreground">
                                {preview.skipped.map((s) => (
                                    <li key={s.sourceId}>
                                        {s.name} ({s.type}) — {s.reason}
                                    </li>
                                ))}
                            </ul>
                        </details>
                    </div>
                )}
            </ImportPanel>
        </ImportPageShell>
    );
}

function ImportComplete({ state }: { state: ImportWizardState }) {
    const { router, result, warned } = state;

    if (!result) return null;

    return (
        <ImportPageShell
            actions={
                <Button onClick={() => router.push("/monitors")}>
                    Go to monitors
                </Button>
            }
        >
            <ImportPanel title="Import complete">
                <div className="space-y-4 p-4">
                    <p className="font-medium">
                        Imported {result.created} monitor(s),{" "}
                        {result.groupsCreated} group(s), and{" "}
                        {result.tagsCreated} tag(s).
                    </p>
                    {warned.length > 0 && (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 text-sm dark:bg-amber-950/30 dark:text-amber-200">
                            <p className="font-medium">
                                These monitors may not be fully compatible —
                                please check them:
                            </p>
                            <ul className="mt-2 list-disc pl-6">
                                {warned.map((m) => (
                                    <li key={m.sourceId}>
                                        {m.name} — {m.warnings?.join(" ")}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </ImportPanel>
        </ImportPageShell>
    );
}
