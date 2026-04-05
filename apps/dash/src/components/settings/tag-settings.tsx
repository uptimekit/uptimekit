import { TagsManager } from "@/components/monitors/tags-manager";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Render a responsive settings section for creating and managing tags.
 *
 * The component displays a heading and descriptive text alongside a Card
 * containing the TagsManager UI, arranged in a single-column layout on small
 * screens and a three-column layout on medium and larger screens.
 *
 * @returns The JSX element containing the heading, description, and a Card with `TagsManager` arranged in a responsive grid.
 */
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
