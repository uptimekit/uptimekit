import { CreateIncidentForm } from "@/components/incidents/create-form";

export default function NewIncidentPage() {
	return (
		<div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-8">
			<div className="flex flex-col gap-2">
				<h1 className="font-bold text-2xl tracking-tight">Create incident</h1>
				<p className="text-muted-foreground text-sm">
					Manually report a new incident to keep your users informed.
				</p>
			</div>
			<CreateIncidentForm />
		</div>
	);
}
