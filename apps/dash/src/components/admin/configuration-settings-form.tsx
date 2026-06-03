"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { sileo } from "sileo";
import { Loader2 } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { client, orpc } from "@/utils/orpc";

interface ConfigFormData {
	instanceName: string;
	dataRetentionDays: string;
}

const DATA_RETENTION_MIN_DAYS = 1;
const DATA_RETENTION_MAX_DAYS = 365;

function normalizeConfigFormData(values: ConfigFormData): ConfigFormData {
	const instanceName = values.instanceName.trim();
	const dataRetentionDaysInput = values.dataRetentionDays.trim();
	const dataRetentionDays = Number(dataRetentionDaysInput);

	if (!instanceName) {
		throw new Error("Instance name is required.");
	}

	if (
		!Number.isInteger(dataRetentionDays) ||
		dataRetentionDays < DATA_RETENTION_MIN_DAYS ||
		dataRetentionDays > DATA_RETENTION_MAX_DAYS
	) {
		throw new Error(
			`Data retention must be between ${DATA_RETENTION_MIN_DAYS} and ${DATA_RETENTION_MAX_DAYS} days.`,
		);
	}

	return {
		instanceName,
		dataRetentionDays: String(dataRetentionDays),
	};
}

function getFormString(formData: FormData, key: keyof ConfigFormData) {
	const value = formData.get(key);
	return typeof value === "string" ? value : "";
}

/**
 * Render a form for viewing and updating instance-wide configuration.
 *
 * Fetches current configuration, populates form fields for "instance_name" and
 * "data_retention_days", and saves changes to those keys when submitted. Shows
 * loading skeletons while fetching and displays success or error toasts after save.
 *
 * @returns The configuration settings form as a React element.
 */
export function ConfigurationSettingsForm() {
	const queryClient = useQueryClient();
	const [formValues, setFormValues] = useState<ConfigFormData>({
		instanceName: "",
		dataRetentionDays: "30",
	});

	// Fetch all configuration values
	const { data, isLoading } = useQuery(orpc.configuration.list.queryOptions());

	// Populate form with fetched values
	useEffect(() => {
		if (data?.items) {
			const instanceName =
				data.items.find((i) => i.key === "instance_name")?.value || "";
			const dataRetentionDays =
				data.items.find((i) => i.key === "data_retention_days")?.value || "30";
			setFormValues({ instanceName, dataRetentionDays });
		}
	}, [data]);

	// Save mutation
	const saveMutation = useMutation({
		mutationFn: async (values: ConfigFormData) => {
			const nextValues = normalizeConfigFormData(values);

			await Promise.all([
				client.configuration.set({
					key: "instance_name",
					value: nextValues.instanceName,
				}),
				client.configuration.set({
					key: "data_retention_days",
					value: nextValues.dataRetentionDays,
				}),
			]);

			return nextValues;
		},
		onSuccess: async (nextValues) => {
			setFormValues(nextValues);
			await queryClient.invalidateQueries({
				queryKey: orpc.configuration.list.key(),
			});
			sileo.success({ title: "Settings saved successfully" });
		},
		onError: (error: Error) => {
			sileo.error({ title: error.message });
		},
	});

	const onSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);

		saveMutation.mutate({
			instanceName: getFormString(formData, "instanceName"),
			dataRetentionDays: getFormString(formData, "dataRetentionDays"),
		});
	};

	if (isLoading) {
		return (
			<Card className="w-full max-w-3xl">
				<CardHeader>
					<CardTitle>General Settings</CardTitle>
					<CardDescription>Instance-wide configuration.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-10 w-24" />
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="w-full max-w-3xl">
			<CardHeader>
				<CardTitle>General Settings</CardTitle>
				<CardDescription>Instance-wide configuration.</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={onSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="instance-name">Instance Name</Label>
						<Input
							id="instance-name"
							name="instanceName"
							nativeInput
							onChange={(event) =>
								setFormValues((current) => ({
									...current,
									instanceName: event.target.value,
								}))
							}
							placeholder="UptimeKit Self-Hosted"
							required
							value={formValues.instanceName}
						/>
						<p className="text-muted-foreground text-sm">
							The name displayed in the dashboard and status pages.
						</p>
					</div>
					<div className="space-y-2">
						<Label htmlFor="data-retention">Data Retention (days)</Label>
						<Input
							id="data-retention"
							min={DATA_RETENTION_MIN_DAYS}
							max={DATA_RETENTION_MAX_DAYS}
							name="dataRetentionDays"
							nativeInput
							onChange={(event) =>
								setFormValues((current) => ({
									...current,
									dataRetentionDays: event.target.value,
								}))
							}
							placeholder="30"
							required
							step={1}
							type="number"
							value={formValues.dataRetentionDays}
						/>
						<p className="text-muted-foreground text-sm">
							How long to keep monitoring data before automatic cleanup.
						</p>
					</div>
					<div className="flex items-center justify-start pt-2">
						<Button type="submit" disabled={saveMutation.isPending}>
							{saveMutation.isPending && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							Save Changes
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
