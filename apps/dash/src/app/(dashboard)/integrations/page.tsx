import { Suspense } from "react";
import { NotificationsTable } from "@/components/integrations/table";

export default function IntegrationsPage() {
    return (
        <div className="flex flex-1 flex-col pb-8">
            <Suspense
                fallback={
                    <div className="flex flex-1 items-center justify-center py-12 text-muted-foreground">
                        Loading notifications...
                    </div>
                }
            >
                <NotificationsTable />
            </Suspense>
        </div>
    );
}
