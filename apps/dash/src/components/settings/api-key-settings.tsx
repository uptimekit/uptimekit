"use client";

import {
    faCheck,
    faCopy,
    faKey,
    faPlus,
    faRotateRight,
    faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { sileo } from "sileo";
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { authClient } from "@/lib/auth-client";

interface ApiKeyRecord {
    id: string;
    name: string | null;
    start: string | null;
    enabled: boolean;
    rateLimitMax: number | null;
    rateLimitTimeWindow: number | null;
    lastRequest: Date | string | null;
    expiresAt: Date | string | null;
    createdAt: Date | string;
}

type CreatedApiKey = ApiKeyRecord & {
    key: string;
};

function formatDate(value: Date | string | null | undefined) {
    if (!value) return "Never";

    return formatDistanceToNow(new Date(value), { addSuffix: true });
}

function formatRateLimit(key: ApiKeyRecord) {
    if (!key.rateLimitMax || !key.rateLimitTimeWindow) return "Unlimited";

    const seconds = Math.round(key.rateLimitTimeWindow / 1000);
    return `${key.rateLimitMax}/${seconds}s`;
}

export function ApiKeySettings() {
    const queryClient = useQueryClient();
    const { data: activeOrg } = authClient.useActiveOrganization();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [keyName, setKeyName] = useState("");
    const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
    const [copied, setCopied] = useState(false);
    const [deletingKey, setDeletingKey] = useState<ApiKeyRecord | null>(null);

    const queryKey = ["organization-api-keys", activeOrg?.id];

    const apiKeysQuery = useQuery({
        queryKey,
        enabled: Boolean(activeOrg?.id),
        queryFn: async () => {
            const { data, error } = await authClient.apiKey.list({
                query: {
                    organizationId: activeOrg?.id,
                    sortBy: "createdAt",
                    sortDirection: "desc",
                },
            });

            if (error) throw new Error(error.message);

            return data.apiKeys as ApiKeyRecord[];
        },
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            if (!activeOrg?.id) throw new Error("No active organization");

            const { data, error } = await authClient.apiKey.create({
                name: keyName.trim() || undefined,
                organizationId: activeOrg.id,
            });

            if (error) throw new Error(error.message);

            return data as CreatedApiKey;
        },
        onSuccess: async (data) => {
            setCreatedKey(data);
            setCopied(false);
            setKeyName("");
            setIsCreateOpen(false);
            await queryClient.invalidateQueries({ queryKey });
            sileo.success({ title: "API key created" });
        },
        onError: (error) => {
            sileo.error({ title: error.message });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({
            keyId,
            enabled,
        }: {
            keyId: string;
            enabled: boolean;
        }) => {
            const { error } = await authClient.apiKey.update({
                keyId,
                enabled,
            });

            if (error) throw new Error(error.message);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey });
            sileo.success({ title: "API key updated" });
        },
        onError: (error) => {
            sileo.error({ title: error.message });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (keyId: string) => {
            const { error } = await authClient.apiKey.delete({
                keyId,
            });

            if (error) throw new Error(error.message);
        },
        onSuccess: async () => {
            setDeletingKey(null);
            await queryClient.invalidateQueries({ queryKey });
            sileo.success({ title: "API key deleted" });
        },
        onError: (error) => {
            sileo.error({ title: error.message });
        },
    });

    const copyCreatedKey = async () => {
        if (!createdKey?.key) return;

        await navigator.clipboard.writeText(createdKey.key);
        setCopied(true);
        sileo.success({ title: "Copied to clipboard" });
    };

    return (
        <div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
            <div className="space-y-2">
                <h2 className="font-semibold text-lg leading-none tracking-tight">
                    API Keys
                </h2>
                <p className="text-muted-foreground text-sm">
                    Create organization-scoped keys for programmatic access to
                    this organization's resources.
                </p>
            </div>

            <Card className="md:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div className="space-y-1">
                        <CardTitle>Organization API keys</CardTitle>
                        <CardDescription>
                            Keys are scoped to{" "}
                            {activeOrg?.name || "the active organization"}.
                        </CardDescription>
                    </div>
                    <Button onClick={() => setIsCreateOpen(true)}>
                        <FontAwesomeIcon icon={faPlus} />
                        Create key
                    </Button>
                </CardHeader>
                <CardContent>
                    {apiKeysQuery.isLoading ? (
                        <div className="flex min-h-48 items-center justify-center text-muted-foreground text-sm">
                            <FontAwesomeIcon
                                icon={faRotateRight}
                                className="mr-2 size-4 animate-spin"
                            />
                            Loading API keys...
                        </div>
                    ) : apiKeysQuery.data?.length ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Key</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Rate limit</TableHead>
                                    <TableHead>Last used</TableHead>
                                    <TableHead className="w-px text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {apiKeysQuery.data.map((apiKey) => (
                                    <TableRow key={apiKey.id}>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <span className="font-medium">
                                                    {apiKey.name ||
                                                        "Untitled key"}
                                                </span>
                                                <span className="text-muted-foreground text-xs">
                                                    Created{" "}
                                                    {formatDate(
                                                        apiKey.createdAt,
                                                    )}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-muted-foreground">
                                            {apiKey.start
                                                ? `${apiKey.start}...`
                                                : "Hidden"}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    apiKey.enabled
                                                        ? "success"
                                                        : "outline"
                                                }
                                            >
                                                {apiKey.enabled
                                                    ? "Enabled"
                                                    : "Disabled"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {formatRateLimit(apiKey)}
                                        </TableCell>
                                        <TableCell>
                                            {formatDate(apiKey.lastRequest)}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-end gap-2">
                                                <Switch
                                                    aria-label={
                                                        apiKey.enabled
                                                            ? "Disable API key"
                                                            : "Enable API key"
                                                    }
                                                    checked={apiKey.enabled}
                                                    disabled={
                                                        updateMutation.isPending
                                                    }
                                                    onCheckedChange={(
                                                        enabled,
                                                    ) =>
                                                        updateMutation.mutate({
                                                            keyId: apiKey.id,
                                                            enabled,
                                                        })
                                                    }
                                                />
                                                <Button
                                                    aria-label="Delete API key"
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        setDeletingKey(apiKey)
                                                    }
                                                >
                                                    <FontAwesomeIcon
                                                        icon={faTrash}
                                                    />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <Empty className="min-h-64">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <FontAwesomeIcon icon={faKey} />
                                </EmptyMedia>
                                <EmptyTitle>No API keys</EmptyTitle>
                                <EmptyDescription>
                                    Create an organization-scoped key to access
                                    the API from scripts and integrations.
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}
                </CardContent>
            </Card>

            <CreateApiKeyDialog
                open={isCreateOpen}
                organizationName={activeOrg?.name}
                keyName={keyName}
                isPending={createMutation.isPending}
                onOpenChange={setIsCreateOpen}
                onKeyNameChange={setKeyName}
                onCreate={() => createMutation.mutate()}
            />
            <CreatedApiKeyDialog
                createdKey={createdKey}
                copied={copied}
                onCopy={copyCreatedKey}
                onClose={() => setCreatedKey(null)}
            />
            <DeleteApiKeyDialog
                apiKey={deletingKey}
                isPending={deleteMutation.isPending}
                onClose={() => setDeletingKey(null)}
                onDelete={(keyId) => deleteMutation.mutate(keyId)}
            />
        </div>
    );
}

function CreateApiKeyDialog({
    open,
    organizationName,
    keyName,
    isPending,
    onOpenChange,
    onKeyNameChange,
    onCreate,
}: {
    open: boolean;
    organizationName?: string;
    keyName: string;
    isPending: boolean;
    onOpenChange: (open: boolean) => void;
    onKeyNameChange: (name: string) => void;
    onCreate: () => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create API key</DialogTitle>
                    <DialogDescription>
                        This key will be scoped to{" "}
                        {organizationName || "the active organization"}.
                    </DialogDescription>
                </DialogHeader>
                <DialogPanel>
                    <div className="grid gap-2">
                        <Label htmlFor="api-key-name">Name</Label>
                        <Input
                            id="api-key-name"
                            value={keyName}
                            placeholder="Production deploy"
                            onChange={(event) =>
                                onKeyNameChange(event.target.value)
                            }
                        />
                    </div>
                </DialogPanel>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button loading={isPending} onClick={onCreate}>
                        Create key
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function CreatedApiKeyDialog({
    createdKey,
    copied,
    onCopy,
    onClose,
}: {
    createdKey: CreatedApiKey | null;
    copied: boolean;
    onCopy: () => void;
    onClose: () => void;
}) {
    return (
        <Dialog
            open={Boolean(createdKey)}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Copy API key</DialogTitle>
                    <DialogDescription>
                        This organization-scoped key is only shown once.
                    </DialogDescription>
                </DialogHeader>
                <DialogPanel>
                    <div className="flex items-center gap-2">
                        <Input
                            className="font-mono"
                            readOnly
                            type={copied ? "text" : "password"}
                            value={createdKey?.key || ""}
                        />
                        <Button size="icon" onClick={onCopy}>
                            {copied ? (
                                <FontAwesomeIcon icon={faCheck} />
                            ) : (
                                <FontAwesomeIcon icon={faCopy} />
                            )}
                        </Button>
                    </div>
                </DialogPanel>
                <DialogFooter>
                    <Button onClick={onClose}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function DeleteApiKeyDialog({
    apiKey,
    isPending,
    onClose,
    onDelete,
}: {
    apiKey: ApiKeyRecord | null;
    isPending: boolean;
    onClose: () => void;
    onDelete: (keyId: string) => void;
}) {
    return (
        <Dialog
            open={Boolean(apiKey)}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete API key?</DialogTitle>
                    <DialogDescription>
                        Requests using this organization-scoped key will stop
                        working immediately.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        loading={isPending}
                        onClick={() => {
                            if (apiKey) onDelete(apiKey.id);
                        }}
                    >
                        Delete key
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
