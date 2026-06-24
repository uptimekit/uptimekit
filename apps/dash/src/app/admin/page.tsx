import {
	faChartColumn,
	faShieldHalved,
	faSignal,
	faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
	getWorkerHeartbeatThreshold,
	isWorkerHeartbeatFresh,
} from "@uptimekit/api/lib/worker-status";
import { db } from "@uptimekit/db";
import { organization, user } from "@uptimekit/db/schema/auth";
import { monitor } from "@uptimekit/db/schema/monitors";
import { worker } from "@uptimekit/db/schema/workers";
import { formatDistanceToNow } from "date-fns";
import { and, count, eq, isNull, lt, or } from "drizzle-orm";
import WorkersMap from "@/components/admin/workers-map";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRegionInfo, isFontAwesomeRegionFlag } from "@/lib/regions";

// Disable prerendering - this page needs database access at runtime
export const dynamic = "force-dynamic";

async function getStats() {
	const [userCount] = await db.select({ count: count() }).from(user);
	const [orgCount] = await db.select({ count: count() }).from(organization);
	const [monitorCount] = await db.select({ count: count() }).from(monitor);
	const [workerCount] = await db.select({ count: count() }).from(worker);

	const heartbeatThreshold = getWorkerHeartbeatThreshold();
	const [unreachableWorkerCount] = await db
		.select({ count: count() })
		.from(worker)
		.where(
			and(
				eq(worker.active, true),
				or(
					isNull(worker.lastHeartbeat),
					lt(worker.lastHeartbeat, heartbeatThreshold),
				),
			),
		);

	return {
		users: userCount?.count || 0,
		orgs: orgCount?.count || 0,
		monitors: monitorCount?.count || 0,
		workers: workerCount?.count || 0,
		unreachableWorkers: unreachableWorkerCount?.count || 0,
	};
}

async function getWorkers() {
	const workers = await db.select().from(worker);
	return workers;
}

function formatHeartbeat(lastHeartbeat: Date | null) {
	if (!lastHeartbeat) {
		return "Never";
	}

	return formatDistanceToNow(new Date(lastHeartbeat), { addSuffix: true });
}

function getWorkerStatus(active: boolean, lastHeartbeat: Date | null) {
	if (!active) {
		return {
			dotClassName: "bg-muted-foreground",
			label: "Disabled",
			variant: "secondary" as const,
		};
	}

	if (isWorkerHeartbeatFresh(lastHeartbeat)) {
		return {
			dotClassName: "bg-green-500",
			label: "Online",
			variant: "success" as const,
		};
	}

	return {
		dotClassName: "bg-amber-500",
		label: "Offline",
		variant: "warning" as const,
	};
}

export default async function AdminPage() {
	const stats = await getStats();
	const workers = await getWorkers();
	const workerRows = workers.map((worker) => ({
		...worker,
		status: getWorkerStatus(worker.active, worker.lastHeartbeat),
	}));
	const onlineWorkerCount = workerRows.filter(
		(worker) => worker.status.label === "Online",
	).length;

	const hasWorkers = stats.workers > 0;
	const hasUnreachableWorkers = stats.unreachableWorkers > 0;
	const systemHealthLabel = !hasWorkers
		? "No workers"
		: hasUnreachableWorkers
			? "Degraded"
			: "Operational";
	const systemHealthClassName = !hasWorkers
		? "text-muted-foreground"
		: hasUnreachableWorkers
			? "text-amber-500"
			: "text-green-500";
	const systemHealthDescription = !hasWorkers
		? "No workers registered yet"
		: hasUnreachableWorkers
			? `${stats.unreachableWorkers} worker${stats.unreachableWorkers === 1 ? "" : "s"} unreachable`
			: "All workers reachable";

	return (
		<div className="flex flex-col p-4 pt-2">
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="font-medium text-sm">Total Users</CardTitle>
						<FontAwesomeIcon
							icon={faUsers}
							className="h-4 w-4 text-muted-foreground"
						/>
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{stats.users}</div>
						<p className="text-muted-foreground text-xs">
							Registered users on platform
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="font-medium text-sm">
							Total Organizations
						</CardTitle>
						<FontAwesomeIcon
							icon={faShieldHalved}
							className="h-4 w-4 text-muted-foreground"
						/>
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{stats.orgs}</div>
						<p className="text-muted-foreground text-xs">Active workspaces</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="font-medium text-sm">
							Active Monitors
						</CardTitle>
						<FontAwesomeIcon
							icon={faSignal}
							className="h-4 w-4 text-muted-foreground"
						/>
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{stats.monitors}</div>
						<p className="text-muted-foreground text-xs">
							Total monitors tracking
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="font-medium text-sm">System Health</CardTitle>
						<FontAwesomeIcon
							icon={faChartColumn}
							className="h-4 w-4 text-muted-foreground"
						/>
					</CardHeader>
					<CardContent>
						<div className={`font-bold text-2xl ${systemHealthClassName}`}>
							{systemHealthLabel}
						</div>
						<p className="text-muted-foreground text-xs">
							{systemHealthDescription}
						</p>
					</CardContent>
				</Card>
			</div>

			<div className="mt-4 grid grid-cols-12 gap-4">
				<Card className="col-span-8">
					<CardHeader>
						<CardTitle>Workers Overview</CardTitle>
					</CardHeader>
					<CardContent className="pl-2">
						<div className="flex h-[calc(100svh-25rem)] w-full items-center justify-center text-muted-foreground">
							<WorkersMap />
						</div>
					</CardContent>
				</Card>

				<Card className="col-span-4">
					<CardHeader className="border-b">
						<div className="flex items-center justify-between gap-3">
							<CardTitle>Workers</CardTitle>
							<Badge
								variant={hasUnreachableWorkers ? "warning" : "success"}
								className="font-sans"
							>
								{onlineWorkerCount} online
							</Badge>
						</div>
					</CardHeader>

					<CardContent className="p-0">
						{workers.length === 0 ? (
							<div className="px-6 py-10 text-center text-muted-foreground text-sm">
								No workers registered yet.
							</div>
						) : (
							<div>
								{workerRows.map((worker) => {
									const regionInfo = getRegionInfo(worker.location);
									const Flag = regionInfo.Flag;

									return (
										<div
											key={worker.id}
											className="border-b px-6 py-4 transition-colors hover:bg-muted/40"
										>
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0">
													<div className="truncate font-medium text-sm">
														{worker.name}
													</div>
													<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
														<span className="inline-flex min-w-0 items-center gap-1.5">
															{isFontAwesomeRegionFlag(Flag) ? (
																<FontAwesomeIcon
																	aria-label={`${regionInfo.label} flag`}
																	icon={Flag}
																	className="size-5 shrink-0 rounded-sm shadow-sm"
																/>
															) : (
																<Flag
																	aria-label={`${regionInfo.label} flag`}
																	className="size-5 shrink-0 rounded-sm shadow-sm"
																/>
															)}
															<span className="truncate">
																{regionInfo.label}
															</span>
														</span>
														<span>{formatHeartbeat(worker.lastHeartbeat)}</span>
													</div>
												</div>
												<Badge
													variant={worker.status.variant}
													className="font-sans"
												>
													<span
														className={`size-1.5 rounded-full ${worker.status.dotClassName}`}
													/>
													{worker.status.label}
												</Badge>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
