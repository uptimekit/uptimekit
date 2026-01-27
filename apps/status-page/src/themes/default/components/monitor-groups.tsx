import { MonitorListItem } from "./monitor-list-item";
import type { GroupedMonitors } from "../../types";

interface MonitorGroupsProps {
	monitorGroups: GroupedMonitors[];
}

export function MonitorGroups({ monitorGroups }: MonitorGroupsProps) {
	return (
		<section className="mb-16 space-y-8">
			{monitorGroups.map((group) => (
				<div
					key={group.group?.id || "ungrouped"}
					className="rounded-2xl border border-border bg-card p-6 shadow-sm"
				>
					{group.group && (
						<h3 className="mb-4 font-bold text-foreground text-xl">
							{group.group.name}
						</h3>
					)}
					<div className="divide-y divide-border">
						{group.monitors.map((monitor) => (
							<MonitorListItem
								key={monitor.id}
								name={monitor.name}
								status={monitor.currentStatus}
								uptimePercentage={monitor.avgUptime}
								history={monitor.history}
								displayStyle={monitor.displayStyle}
								description={monitor.description}
							/>
						))}
					</div>
				</div>
			))}
		</section>
	);
}
