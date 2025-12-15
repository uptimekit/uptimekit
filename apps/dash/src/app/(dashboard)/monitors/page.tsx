"use client";

import { MonitorsTable, type Monitor } from "@/components/monitors/table";
import { orpc } from "@/utils/orpc";
import { useQuery } from "@tanstack/react-query";

export default function MonitorsPage() {
	const { data: monitors } = useQuery({
		...orpc.monitors.list.queryOptions(),
		refetchInterval: 60_000,
	});

	const tableData: Monitor[] =
		monitors?.map((m) => ({
			id: m.id,
			name: m.name,
			url: (m.config as { url: string }).url || "", // simplified safely access
			status: (m as any).status || "pending",
			statusText:
				(m as any).status === "up"
					? "Operational"
					: (m as any).status === "down"
						? "Downtime"
						: (m as any).status === "degraded"
							? "Degraded"
							: (m as any).status === "maintenance"
								? "Maintenance"
								: "Pending",
			duration: "0s",
			usedOn: 0,
			frequency: `${m.interval}s`,
			hasIncident: false,
			active: m.active,
		})) ?? [];

	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			<MonitorsTable data={tableData} />
		</div>
	);
}
