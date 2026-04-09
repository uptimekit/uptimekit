/** biome-ignore-all lint/suspicious/noExplicitAny: its okay */
"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { CreateMonitorForm } from "@/components/monitors/create-form";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/utils/orpc";

export default function MonitorEditPage() {
	const params = useParams();
	const id = params.id as string;

	const { data: monitor, isLoading } = useQuery(
		orpc.monitors.get.queryOptions({ input: { id } }),
	);

	if (isLoading) {
		return (
			<div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-8">
				<div className="flex flex-col gap-2">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-4 w-96" />
				</div>
				<div className="space-y-6">
					<Skeleton className="h-[200px] w-full" />
					<Skeleton className="h-[200px] w-full" />
				</div>
			</div>
		);
	}

	if (!monitor) {
		return <div>Monitor not found</div>;
	}

	return (
		<div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-8">
			<div className="flex flex-col gap-2">
				<h1 className="font-bold text-2xl tracking-tight">Edit monitor</h1>
				<p className="text-muted-foreground text-sm">
					Update configuration for {monitor.name}
				</p>
			</div>
			<CreateMonitorForm
				monitorId={monitor.id}
				initialData={{
					...monitor,
					config: monitor.config as any,
					// flatten config into initialData if structure matches flat form or pass as config
					// The form expects flat fields like url, hostname etc in initialData (which is FormValues)
					// but monitor.config is nested object.
					// We need to spread config into initialData
					...(monitor.config as any),
					workerIds: monitor.workerIds,
					groupId: monitor.groupId || undefined,
				}}
			/>
		</div>
	);
}
