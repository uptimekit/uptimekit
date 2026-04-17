import { db } from "@uptimekit/db";
import { organization, user } from "@uptimekit/db/schema/auth";
import { monitor } from "@uptimekit/db/schema/monitors";
import { worker } from "@uptimekit/db/schema/workers";
import { and, count, eq, isNotNull, sql } from "drizzle-orm";
import { Activity, BarChart3, Shield, Users } from "lucide-react";
import WorkersMap from "@/components/admin/workers-map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Disable prerendering - this page needs database access at runtime
export const dynamic = "force-dynamic";

async function getStats() {
	const [userCount] = await db.select({ count: count() }).from(user);
	const [orgCount] = await db.select({ count: count() }).from(organization);
	const [monitorCount] = await db.select({ count: count() }).from(monitor);
	const [workerCount] = await db.select({ count: count() }).from(worker);

	const heartbeatThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes
	const [unreachableWorkerCount] = await db
		.select({ count: count() })
		.from(worker)
		.where(
			and(
				isNotNull(worker.lastHeartbeat),
				sql`${worker.lastHeartbeat} < ${heartbeatThreshold}`
			)
		);

	return {
		users: userCount?.count || 0,
		orgs: orgCount?.count || 0,
		monitors: monitorCount?.count || 0,
		workers: workerCount?.count || 0,
		unreachableWorkers: unreachableWorkerCount?.count || 0,
	};
}

export default async function AdminPage() {
	const stats = await getStats();
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
		<div className="flex flex-col gap-8 p-4">
			<div>
				<h1 className="font-bold text-3xl tracking-tight">Admin Dashboard</h1>
				<p className="text-muted-foreground">
					Manage your instance, users, and organizations.
				</p>
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="font-medium text-sm">Total Users</CardTitle>
						<Users className="h-4 w-4 text-muted-foreground" />
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
						<Shield className="h-4 w-4 text-muted-foreground" />
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
						<Activity className="h-4 w-4 text-muted-foreground" />
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
						<BarChart3 className="h-4 w-4 text-muted-foreground" />
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

			<div className="mt-8 grid grid-cols-12 gap-4">
				<Card className="col-span-8">
					<CardHeader>
						<CardTitle>Workers Overview</CardTitle>
					</CardHeader>
					<CardContent className="pl-2">
						<div className="flex h-[800px] w-full items-center justify-center text-muted-foreground">
							<WorkersMap />
						</div>
					</CardContent>
				</Card>

				<Card className="col-span-4">
					<CardHeader>
						<CardTitle>Workers</CardTitle>
					</CardHeader>
					<CardContent className="pl-2">
						<div className="flex h-full w-full items-center justify-center text-muted-foreground">
							Workers blah blah
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}