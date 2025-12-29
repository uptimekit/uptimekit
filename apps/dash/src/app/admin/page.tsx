import { db } from "@uptimekit/db";
import { organization, user } from "@uptimekit/db/schema/auth";
import { monitor } from "@uptimekit/db/schema/monitors";
import { count } from "drizzle-orm";
import { Activity, BarChart3, Shield, Users } from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

// Disable prerendering - this page needs database access at runtime
export const dynamic = "force-dynamic";

async function getStats() {
	const [userCount] = await db.select({ count: count() }).from(user);
	const [orgCount] = await db.select({ count: count() }).from(organization);
	const [monitorCount] = await db.select({ count: count() }).from(monitor);

	return {
		users: userCount?.count || 0,
		orgs: orgCount?.count || 0,
		monitors: monitorCount?.count || 0,
	};
}

export default async function AdminPage() {
	const stats = await getStats();

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
						<div className="font-bold text-2xl text-green-500">Operational</div>
						<p className="text-muted-foreground text-xs">All systems normal</p>
					</CardContent>
				</Card>
			</div>

			<div className="mt-8">
				<Card className="col-span-4">
					<CardHeader>
						<CardTitle>Recent Overview</CardTitle>
						<CardDescription>
							A summary of system usage and growth. (Placeholder)
						</CardDescription>
					</CardHeader>
					<CardContent className="pl-2">
						<div className="flex h-[200px] items-center justify-center text-muted-foreground">
							Chart placeholder
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
