import { ConfigurationSettingsForm } from "@/components/admin/configuration-settings-form";

export default function AdminSettingsPage() {
	return (
		<div className="flex flex-col gap-6 p-4">
			<div>
				<h1 className="font-bold text-3xl tracking-tight">System Settings</h1>
				<p className="text-muted-foreground">
					Global configuration for the UptimeKit instance.
				</p>
			</div>
			<ConfigurationSettingsForm />
		</div>
	);
}
