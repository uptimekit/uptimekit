import { Suspense } from "react";
import { CreateIncidentForm } from "@/components/incidents/create-form";

export default function NewIncidentPage() {
    return (
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-8">
            <div className="flex flex-col gap-2">
                <h1 className="font-bold text-2xl tracking-tight">
                    Create incident
                </h1>
                <p className="text-muted-foreground text-sm">
                    Manually report a new incident to keep your users informed.
                </p>
            </div>
            <Suspense
                fallback={
                    <div className="flex flex-1 items-center justify-center py-12 text-muted-foreground">
                        Loading incident form...
                    </div>
                }
            >
                <CreateIncidentForm />
            </Suspense>
        </div>
    );
}
