import { CreateMonitorForm } from "@/components/monitors/create-form";

export default function CreateMonitorPage() {
	return (
		<div className="flex flex-1 flex-col gap-6 p-4 pt-0">
			<div className="flex flex-col gap-2">
				<h1 className="font-bold text-2xl tracking-tight">Create monitor</h1>
				<p className="text-muted-foreground text-sm">
					Configure a new monitor to track the uptime and performance of your
					services.
				</p>
			</div>
			<div className="rounded-xl border bg-card p-6 shadow-sm">
				<CreateMonitorForm />
			</div>
		</div>
	);
}
