import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminSettingsPage() {
	return (
		<div className="flex flex-col gap-6 p-4">
			<div>
				<h1 className="font-bold text-3xl tracking-tight">System Settings</h1>
				<p className="text-muted-foreground">
					Global configuration for the UptimeKit instance.
				</p>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>General Settings</CardTitle>
					<CardDescription>Instance-wide configuration.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="instance-name">Instance Name</Label>
						<Input
							id="instance-name"
							defaultValue="UptimeKit Self-Hosted"
							placeholder="Enter instance name"
						/>
					</div>
					<div className="flex items-center justify-start">
						<Button>Save Changes</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
