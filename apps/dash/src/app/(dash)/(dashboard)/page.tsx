import { Suspense } from "react";
import { IncidentsTable } from "@/components/incidents/table";

export default async function IncidentsPage() {
    return (
        <div className="flex flex-1 flex-col pb-8">
            <Suspense
                fallback={
                    <div className="flex flex-1 items-center justify-center py-12 text-muted-foreground">
                        Loading incidents...
                    </div>
                }
            >
                <IncidentsTable />
            </Suspense>
        </div>
    );
}
