/** biome-ignore-all lint/suspicious/noExplicitAny: integration configs are provider-specific */
"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { alertManagerIntegrationMeta } from "@uptimekit/api/pkg/integrations/definitions/alertmanager-meta";
import { discordIntegrationMeta } from "@uptimekit/api/pkg/integrations/definitions/discord-meta";
import { telegramIntegrationMeta } from "@uptimekit/api/pkg/integrations/definitions/telegram-meta";
import { webhookIntegrationMeta } from "@uptimekit/api/pkg/integrations/definitions/webhook-meta";
import type { IntegrationDefinition } from "@uptimekit/api/pkg/integrations/registry";
import { Plus, Send, Settings2, Trash2, Webhook } from "lucide-react";
import { useState } from "react";
import { sileo } from "sileo";
import { z } from "zod";
import { ConfigDialog } from "@/components/integrations/config-dialog";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Dialog,
	DialogDescription,
	DialogHeader,
	DialogPanel,
	DialogPopup,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { client } from "@/utils/orpc";

type ConfiguredNotification = {
	id: string;
	name: string;
	type: string;
	config: any;
	active: boolean;
	isDefault: boolean;
	assignedMonitorCount: number;
};

const frontendRegistry = {
	webhook: {
		...webhookIntegrationMeta,
		handler: async () => {},
	} as IntegrationDefinition,
	discord: {
		...discordIntegrationMeta,
		handler: async () => {},
	} as IntegrationDefinition,
	telegram: {
		...telegramIntegrationMeta,
		handler: async () => {},
	} as IntegrationDefinition,
	alertmanager: {
		...alertManagerIntegrationMeta,
		handler: async () => {},
	} as IntegrationDefinition,
};

function getIntegrationDefinition(integration: {
	id: string;
	name?: string;
	description?: string;
	type?: "export" | "import";
	events?: string[];
}) {
	return (
		(frontendRegistry as Record<string, IntegrationDefinition>)[
			integration.id
		] ||
		({
			...integration,
			name: integration.name || integration.id,
			type: integration.type || "export",
			configSchema: {
				parse: () => ({}),
				shape: { url: z.string() },
			} as any,
			events: integration.events || [],
			handler: async () => {},
		} as IntegrationDefinition)
	);
}

function IntegrationIcon({
	integration,
}: {
	integration: IntegrationDefinition;
}) {
	if (integration.logo) {
		return (
			<div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted sm:size-12">
				{/* biome-ignore lint/performance/noImgElement: integration logos are static public assets */}
				<img
					src={integration.logo}
					alt={integration.name}
					className="size-6 object-contain sm:size-8"
				/>
			</div>
		);
	}

	const Icon = integration.id === "webhook" ? Webhook : Settings2;

	return (
		<div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted sm:size-12">
			<Icon className="size-5 sm:size-6" />
		</div>
	);
}

export default function IntegrationsPage() {
	const [providerDialogOpen, setProviderDialogOpen] = useState(false);
	const [selectedIntegration, setSelectedIntegration] =
		useState<IntegrationDefinition | null>(null);
	const [selectedConfig, setSelectedConfig] =
		useState<ConfiguredNotification | null>(null);
	const [configToRemove, setConfigToRemove] =
		useState<ConfiguredNotification | null>(null);

	const { data: availableIntegrations, isLoading: isLoadingAvailable } =
		useQuery({
			queryKey: ["integrations", "available"],
			queryFn: async () => client.integrations.listAvailable(),
		});

	const {
		data: configuredConfigs,
		isLoading: isLoadingConfigured,
		refetch,
	} = useQuery({
		queryKey: ["integrations", "configured"],
		queryFn: async () => client.integrations.listConfigured(),
	});

	const configureMutation = useMutation({
		mutationFn: async (data: {
			id?: string;
			name: string;
			type: string;
			config: any;
			active: boolean;
			isDefault: boolean;
			applyToExistingMonitors: boolean;
		}) => {
			await client.integrations.configure(data);
		},
		onSuccess: () => {
			refetch();
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (id: string) => {
			await client.integrations.delete({ id });
		},
		onSuccess: () => {
			refetch();
		},
	});

	const testMutation = useMutation({
		mutationFn: async (id: string) => {
			await client.integrations.test({ id });
		},
	});

	const configuredNotifications =
		(configuredConfigs as ConfiguredNotification[] | undefined) || [];

	if (isLoadingAvailable || isLoadingConfigured) {
		return (
			<div className="flex flex-1 flex-col py-8">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-24" />
					<Skeleton className="h-24" />
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col py-8">
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div className="flex flex-col gap-1">
						<h1 className="font-bold text-2xl">Notifications</h1>
						<p className="text-muted-foreground">
							Create notification channels and assign them to monitors.
						</p>
					</div>
					<Button type="button" onClick={() => setProviderDialogOpen(true)}>
						<Plus data-icon="inline-start" />
						Add notification
					</Button>
				</div>

				{configuredNotifications.length === 0 ? (
					<Empty className="rounded-lg border border-dashed py-12">
						<EmptyHeader>
							<EmptyTitle>No notifications configured</EmptyTitle>
							<EmptyDescription>
								Add a notification channel before assigning it to monitors.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Button type="button" onClick={() => setProviderDialogOpen(true)}>
								<Plus data-icon="inline-start" />
								Add notification
							</Button>
						</EmptyContent>
					</Empty>
				) : (
					<div className="grid grid-cols-1 gap-4">
						{configuredNotifications.map((config) => {
							const integration = getIntegrationDefinition({
								id: config.type,
							});

							return (
								<Card
									key={config.id}
									className="flex w-full flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
								>
									<div className="flex min-w-0 items-center gap-3 sm:gap-4">
										<IntegrationIcon integration={integration} />
										<div className="flex min-w-0 flex-col gap-2">
											<div className="flex flex-wrap items-center gap-2">
												<h2 className="truncate font-semibold text-sm">
													{config.name}
												</h2>
												<Badge variant="outline">{integration.name}</Badge>
												<Badge
													variant={
														integration.type === "export" ? "info" : "secondary"
													}
												>
													{integration.type === "export" ? "Export" : "Import"}
												</Badge>
												{config.active ? (
													<Badge variant="success">Active</Badge>
												) : (
													<Badge variant="secondary">Inactive</Badge>
												)}
												{config.isDefault && (
													<Badge variant="warning">Default</Badge>
												)}
											</div>
											<p className="text-muted-foreground text-sm">
												Assigned to {config.assignedMonitorCount} monitor
												{config.assignedMonitorCount === 1 ? "" : "s"}.
											</p>
										</div>
									</div>
									<div className="flex shrink-0 flex-wrap gap-2">
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => {
												setSelectedIntegration(integration);
												setSelectedConfig(config);
											}}
										>
											<Settings2 data-icon="inline-start" />
											Edit
										</Button>
										{integration.type === "export" && (
											<Button
												type="button"
												variant="outline"
												size="sm"
												disabled={testMutation.isPending}
												onClick={async () => {
													try {
														await testMutation.mutateAsync(config.id);
														sileo.success({
															title: "Test event sent successfully",
														});
													} catch (error: any) {
														sileo.error({
															title:
																error.message || "Failed to send test event",
														});
													}
												}}
											>
												<Send data-icon="inline-start" />
												Test
											</Button>
										)}
										<Button
											type="button"
											variant="destructive"
											size="sm"
											disabled={deleteMutation.isPending}
											onClick={() => setConfigToRemove(config)}
										>
											<Trash2 data-icon="inline-start" />
											Remove
										</Button>
									</div>
								</Card>
							);
						})}
					</div>
				)}

				<Dialog open={providerDialogOpen} onOpenChange={setProviderDialogOpen}>
					<DialogPopup className="sm:max-w-2xl">
						<DialogHeader>
							<DialogTitle>Add notification</DialogTitle>
							<DialogDescription>
								Choose a provider, then configure where events should be sent.
							</DialogDescription>
						</DialogHeader>
						<DialogPanel className="grid gap-3 sm:grid-cols-2">
							{availableIntegrations?.map((integrationMeta) => {
								const integration = getIntegrationDefinition(integrationMeta);

								return (
									<button
										key={integration.id}
										type="button"
										className="flex min-w-0 items-center gap-3 rounded-lg border bg-background p-4 text-left transition-colors hover:bg-muted/50"
										onClick={() => {
											setSelectedIntegration(integration);
											setSelectedConfig(null);
											setProviderDialogOpen(false);
										}}
									>
										<IntegrationIcon integration={integration} />
										<div className="min-w-0">
											<div className="flex items-center gap-2">
												<p className="truncate font-medium text-sm">
													{integration.name}
												</p>
												<Badge variant="outline">
													{integration.type === "export" ? "Export" : "Import"}
												</Badge>
											</div>
											<p className="line-clamp-2 text-muted-foreground text-sm">
												{integration.description}
											</p>
										</div>
									</button>
								);
							})}
						</DialogPanel>
					</DialogPopup>
				</Dialog>

				{selectedIntegration && (
					<ConfigDialog
						open={!!selectedIntegration}
						onOpenChange={(open) => {
							if (!open) {
								setSelectedIntegration(null);
								setSelectedConfig(null);
							}
						}}
						integration={selectedIntegration}
						initialConfig={selectedConfig?.config}
						configId={selectedConfig?.id}
						initialName={selectedConfig?.name}
						initialActive={selectedConfig?.active ?? true}
						initialIsDefault={selectedConfig?.isDefault ?? false}
						onSave={async (values) => {
							await configureMutation.mutateAsync({
								id: selectedConfig?.id,
								type: selectedIntegration.id,
								...values,
							});
							setSelectedIntegration(null);
							setSelectedConfig(null);
						}}
						onDelete={
							selectedConfig
								? async () => {
										await deleteMutation.mutateAsync(selectedConfig.id);
									}
								: undefined
						}
						onTest={
							selectedConfig
								? async () => {
										await testMutation.mutateAsync(selectedConfig.id);
									}
								: undefined
						}
					/>
				)}

				<AlertDialog
					open={!!configToRemove}
					onOpenChange={(open) => {
						if (!open) setConfigToRemove(null);
					}}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Remove notification</AlertDialogTitle>
							<AlertDialogDescription>
								Remove {configToRemove?.name}? Monitor assignments for this
								notification will also be removed.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={deleteMutation.isPending}>
								Cancel
							</AlertDialogCancel>
							<Button
								type="button"
								variant="destructive"
								disabled={deleteMutation.isPending}
								onClick={async () => {
									if (!configToRemove) return;

									try {
										await deleteMutation.mutateAsync(configToRemove.id);
										setConfigToRemove(null);
										sileo.success({ title: "Notification removed" });
									} catch (error: any) {
										sileo.error({
											title: error.message || "Failed to remove notification",
										});
									}
								}}
							>
								{deleteMutation.isPending ? "Removing..." : "Remove"}
							</Button>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</div>
	);
}
