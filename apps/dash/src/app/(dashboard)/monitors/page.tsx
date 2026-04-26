import { Suspense } from "react";
import { MonitorsTable } from "@/components/monitors/table";

export default function MonitorsPage() {
	return (
		<div className="flex flex-1 flex-col pb-8">
			<Suspense
				fallback={
					<div className="flex flex-1 items-center justify-center py-12 text-muted-foreground">
						Loading monitors...
					</div>
				}
			>
				<MonitorsTable />
			</Suspense>
		</div>
	);
}
