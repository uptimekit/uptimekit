import { TagsManager } from "@/components/monitors/tags-manager";
import { Card, CardContent } from "@/components/ui/card";

export function TagSettings() {
	return (
		<div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
			<div className="space-y-2">
				<h2 className="font-semibold text-lg leading-none tracking-tight">
					Tags
				</h2>
				<p className="text-muted-foreground text-sm">
					Create tags to categorize and filter your monitors.
				</p>
			</div>

			<Card className="md:col-span-2">
				<CardContent className="p-6">
					<TagsManager />
				</CardContent>
			</Card>
		</div>
	);
}
