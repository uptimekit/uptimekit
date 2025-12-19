import { CreateMonitorForm } from "@/components/monitors/create-form";

export default function CreateMonitorPage() {
	return (
		<div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-8">
			<div className="flex flex-col gap-2">
				<h1 className="font-bold text-2xl tracking-tight">Create monitor</h1>
				<p className="text-muted-foreground text-sm">
					Configure a new monitor to track the uptime and performance of your
					services.
				</p>
			</div>

			<CreateMonitorForm />
		</div>
	);
}
