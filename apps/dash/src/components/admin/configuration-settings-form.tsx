"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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

export function ConfigurationSettingsForm() {
	const queryClient = useQueryClient();
	const {
		register,
		handleSubmit,
		reset,
		formState: { isDirty },
	} = useForm<ConfigFormData>({
		defaultValues: {
			instanceName: "",
			dataRetentionDays: "30",
		},
	});

	// Fetch all configuration values
	const { data, isLoading } = useQuery({
		...orpc.configuration.list.queryOptions(),
	});

	// Populate form with fetched values
	useEffect(() => {
		if (data?.items) {
			const instanceName =
				data.items.find((i) => i.key === "instance_name")?.value || "";
			const dataRetentionDays =
				data.items.find((i) => i.key === "data_retention_days")?.value || "30";
			reset({ instanceName, dataRetentionDays });
		}
	}, [data, reset]);

	// Save mutation
	const saveMutation = useMutation({
		mutationFn: async (values: ConfigFormData) => {
			await Promise.all([
				client.configuration.set({
					key: "instance_name",
					value: values.instanceName,
				}),
				client.configuration.set({
					key: "data_retention_days",
					value: values.dataRetentionDays,
				}),
			]);
		},
		onSuccess: () => {
			toast.success("Settings saved successfully");
			queryClient.invalidateQueries({ queryKey: ["configuration"] });
		},
		onError: (error: Error) => {
			toast.error(error.message);
		},
	});

	const onSubmit = (values: ConfigFormData) => {
		saveMutation.mutate(values);
	};

	if (isLoading) {
		return (
			<Card>
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
		<Card>
			<CardHeader>
				<CardTitle>General Settings</CardTitle>
				<CardDescription>Instance-wide configuration.</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="instance-name">Instance Name</Label>
						<Input
							id="instance-name"
							placeholder="UptimeKit Self-Hosted"
							{...register("instanceName")}
						/>
						<p className="text-muted-foreground text-sm">
							The name displayed in the dashboard and status pages.
						</p>
					</div>
					<div className="space-y-2">
						<Label htmlFor="data-retention">Data Retention (days)</Label>
						<Input
							id="data-retention"
							type="number"
							min="1"
							max="365"
							placeholder="30"
							{...register("dataRetentionDays")}
						/>
						<p className="text-muted-foreground text-sm">
							How long to keep monitoring data before automatic cleanup.
						</p>
					</div>
					<div className="flex items-center justify-start pt-2">
						<Button type="submit" disabled={saveMutation.isPending || !isDirty}>
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
