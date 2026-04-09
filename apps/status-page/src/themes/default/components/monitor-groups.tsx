import type { GroupedMonitors } from "../../types";
import { MonitorListItem } from "./monitor-list-item";

interface MonitorGroupsProps {
	monitorGroups: GroupedMonitors[];
	layout?: "vertical" | "horizontal";
	barStyle?: "normal" | "length" | "signal";
}

export function MonitorGroups({
	monitorGroups,
	layout = "vertical",
	barStyle = "normal",
}: MonitorGroupsProps) {
	const isGrid = layout === "horizontal";

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
					<div
						className={
							isGrid
								? "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
								: "divide-y divide-border"
						}
					>
						{group.monitors.map((monitor) => (
							<MonitorListItem
								key={monitor.id}
								name={monitor.name}
								status={monitor.currentStatus}
								uptimePercentage={monitor.avgUptime}
								history={monitor.history}
								displayStyle={monitor.displayStyle}
								description={monitor.description}
								barStyle={barStyle}
								className={isGrid ? "rounded-lg border p-4" : undefined}
							/>
						))}
					</div>
				</div>
			))}
		</section>
	);
}
