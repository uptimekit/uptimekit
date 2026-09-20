import { ConfigurationSettingsForm } from "@/components/admin/configuration-settings-form";

export default function AdminSettingsPage() {
    return (
        <div className="mx-auto w-full max-w-6xl space-y-4">
            <div>
                <h1 className="font-bold text-2xl tracking-tight">
                    System Settings
                </h1>
                <p className="text-muted-foreground text-sm">
                    Global configuration for the UptimeKit instance.
                </p>
            </div>
            <ConfigurationSettingsForm />
        </div>
    );
}
