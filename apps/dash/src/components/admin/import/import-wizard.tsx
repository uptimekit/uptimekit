"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

export function ImportWizard() {
    const router = useRouter();

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
            setResult(data);
            setStep("done");
        },
        onError: (error: Error) =>
            sileo.error({ title: error.message || "Import failed" }),
    });

    const selectedMonitors = useMemo(
        () =>
            (preview?.supported ?? []).filter((m) =>
                selectedSourceIds.has(m.sourceId),
            ),
        [preview, selectedSourceIds],
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

    if (step === "connect") {
        return (
            <>
                <Card>
                    <CardContent className="space-y-4 pt-6">
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
                        <Button
                            disabled={!canPreview || previewMutation.isPending}
                            onClick={() => previewMutation.mutate()}
                        >
                            {previewMutation.isPending
                                ? "Connecting…"
                                : "Connect & preview"}
                        </Button>
                    </CardContent>
                </Card>

                <Dialog
                    open={sourceDialogOpen}
                    onOpenChange={setSourceDialogOpen}
                >
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
            </>
        );
    }

    if (step === "review" && preview) {
        const exceedsQuota =
            preview.quota.remaining !== null &&
            selectedMonitors.length > preview.quota.remaining;

        return (
            <div className="space-y-6">
                <Card>
                    <CardContent className="space-y-4 pt-6">
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
                            Importing isn't idempotent — running it again
                            creates duplicate monitors and groups (tags are
                            matched by name).
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
                                            checked={selectedWorkerIds.has(
                                                w.id,
                                            )}
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
                                    No workers selected — monitors will be
                                    imported but stay pending until you assign
                                    workers to them.
                                </p>
                            )}
                        </div>

                        {preview.availableNotifications.length > 0 && (
                            <div className="space-y-2">
                                <Label>
                                    Notifications (applied to all imported
                                    monitors)
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
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-10" />
                                    <TableHead>Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Tags</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {preview.supported.map((m: PreviewMonitor) => (
                                    <TableRow key={m.sourceId}>
                                        <TableCell>
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
                                        <TableCell>{m.name}</TableCell>
                                        <TableCell>{m.type}</TableCell>
                                        <TableCell>
                                            {m.tagNames.join(", ")}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {preview.skipped.length > 0 && (
                            <details className="mt-4 text-sm">
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
                        )}
                    </CardContent>
                </Card>

                <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setStep("connect")}>
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
                </div>
            </div>
        );
    }

    if (step === "done" && result) {
        return (
            <Card>
                <CardContent className="space-y-4 pt-6">
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
                    <Button onClick={() => router.push("/monitors")}>
                        Go to monitors
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return null;
}
