/** biome-ignore-all lint/suspicious/noExplicitAny: its okay */
"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { alertManagerIntegrationMeta } from "@uptimekit/api/pkg/integrations/definitions/alertmanager-meta";
import { discordIntegrationMeta } from "@uptimekit/api/pkg/integrations/definitions/discord-meta";
import { telegramIntegrationMeta } from "@uptimekit/api/pkg/integrations/definitions/telegram-meta";
import { webhookIntegrationMeta } from "@uptimekit/api/pkg/integrations/definitions/webhook-meta";
import type { IntegrationDefinition } from "@uptimekit/api/pkg/integrations/registry";
import { Settings2, Webhook } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { ConfigDialog } from "@/components/integrations/config-dialog";
import { IntegrationCard } from "@/components/integrations/integration-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { client } from "@/utils/orpc";

export default function IntegrationsPage() {
	const [selectedIntegration, setSelectedIntegration] =
		useState<IntegrationDefinition | null>(null);
	const [activeTab, setActiveTab] = useState<"popular" | "import" | "export">(
		"popular",
	);
	const { data: availableIntegrations, isLoading: isLoadingAvailable } =
		useQuery({
			queryKey: ["integrations", "available"],
			queryFn: async () => {
				const res = await client.integrations.listAvailable();
				return res;
			},
		});

	const {
		data: configuredConfigs,
		isLoading: isLoadingConfigured,
		refetch,
	} = useQuery({
		queryKey: ["integrations", "configured"],
		queryFn: async () => await client.integrations.listConfigured(),
	});

	const configureMutation = useMutation({
		mutationFn: async (data: {
			type: string;
			config: any;
			active?: boolean;
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

	// Removed the require block as webhookIntegration is now imported at the top.
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

	if (isLoadingAvailable || isLoadingConfigured) {
		return (
			<div className="flex flex-1 flex-col py-8">
				<div className="mx-auto w-full max-w-6xl space-y-4 px-4">
					<Skeleton className="h-8 w-48" />
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
						<Skeleton className="h-48" />
						<Skeleton className="h-48" />
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col py-8">
			<div className="mx-auto w-full max-w-6xl space-y-4 px-4">
				<div className="mb-6">
					<h1 className="font-bold text-2xl">Integrations</h1>
					<p className="text-muted-foreground">
						Connect your monitoring with external tools.
					</p>
				</div>

				<div className="mb-6 flex space-x-4 border-b">
					<button
						type="button"
						onClick={() => setActiveTab("popular")}
						className={cn(
							"border-b-2 px-4 py-2 font-medium text-sm transition-colors",
							activeTab === "popular"
								? "border-primary text-primary"
								: "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
						)}
					>
						Popular
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("import")}
						className={cn(
							"border-b-2 px-4 py-2 font-medium text-sm transition-colors",
							activeTab === "import"
								? "border-primary text-primary"
								: "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
						)}
					>
						Importing data
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("export")}
						className={cn(
							"border-b-2 px-4 py-2 font-medium text-sm transition-colors",
							activeTab === "export"
								? "border-primary text-primary"
								: "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
						)}
					>
						Exporting data
					</button>
				</div>

				{(() => {
					const filteredIntegrations = availableIntegrations?.filter(
						(integration: any) => {
							const def = (frontendRegistry as any)[integration.id];
							const type = def?.type || integration.type;

							if (activeTab === "popular") return true;
							if (activeTab === "import") return type === "import";
							if (activeTab === "export") return type === "export";
							return true;
						},
					);

					if (!filteredIntegrations || filteredIntegrations.length === 0) {
						return (
							<div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/10 py-12 text-center">
								<p className="font-medium text-lg">No integrations found</p>
								<p className="text-muted-foreground text-sm">
									There are no integrations available in this category.
								</p>
							</div>
						);
					}

					return (
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2">
							{filteredIntegrations.map((integrationMeta: any) => {
								const config = configuredConfigs?.find(
									(c: any) => c.type === integrationMeta.id,
								);
								// Use the imported definition to get the schema
								const fullDef = (frontendRegistry as any)[
									integrationMeta.id
								] || {
									// Fallback if not found locally but exists on backend (shouldn't happen if synced)
									...integrationMeta,
									configSchema: {
										parse: () => {},
										shape: { url: z.string() },
									} as any,
								};

								// Icon mapping
								let Icon: React.ReactNode;
								if (fullDef.logo) {
									Icon = (
										<div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted sm:size-12">
											{/** biome-ignore lint/performance/noImgElement: external image therefor next would start crying */}
											<img
												src={fullDef.logo}
												alt={fullDef.name}
												className="size-6 object-contain sm:size-8"
											/>
										</div>
									);
								} else {
									Icon =
										integrationMeta.id === "webhook" ? (
											<div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted sm:size-12">
												<Webhook className="size-5 sm:size-6" />
											</div>
										) : (
											<div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted sm:size-12">
												<Settings2 className="size-5 sm:size-6" />
											</div>
										);
								}

								return (
									<IntegrationCard
										key={integrationMeta.id}
										integration={fullDef}
										configured={!!config}
										active={config?.active}
										icon={Icon}
										category={fullDef.type === "export" ? "Export" : "Import"}
										onConfigure={() => setSelectedIntegration(fullDef)}
									/>
								);
							})}
						</div>
					);
				})()}

				{selectedIntegration &&
					(() => {
						const existingConfig = configuredConfigs?.find(
							(c) => c.type === selectedIntegration.id,
						);
						return (
							<ConfigDialog
								open={!!selectedIntegration}
								onOpenChange={(open) => !open && setSelectedIntegration(null)}
								integration={selectedIntegration}
								initialConfig={existingConfig?.config}
								configId={existingConfig?.id}
								onSave={async (config) => {
									await configureMutation.mutateAsync({
										type: selectedIntegration.id,
										config,
									});
									setSelectedIntegration(null);
								}}
								onDelete={
									existingConfig
										? async () => {
												await deleteMutation.mutateAsync(existingConfig.id);
											}
										: undefined
								}
								onTest={
									existingConfig
										? async () => {
												await testMutation.mutateAsync(existingConfig.id);
											}
										: undefined
								}
							/>
						);
					})()}
			</div>
		</div>
	);
}
