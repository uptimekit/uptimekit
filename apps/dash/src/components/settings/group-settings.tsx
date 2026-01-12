import { GroupsManager } from "@/components/monitors/groups-manager";
import { Card, CardContent } from "@/components/ui/card";

export function GroupSettings() {
	return (
		<div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
			<div className="space-y-2">
				<h2 className="font-semibold text-lg leading-none tracking-tight">
					Groups
				</h2>
				<p className="text-muted-foreground text-sm">
					Organize your monitors into groups for better management.
				</p>
			</div>

			<Card className="md:col-span-2">
				<CardContent className="p-6">
					<GroupsManager />
				</CardContent>
			</Card>
		</div>
	);
}
