import { WorkersTable } from "@/components/admin/workers-table";
import { db } from "@uptimekit/db";
import { worker } from "@uptimekit/db/schema/workers";
import { desc } from "drizzle-orm";

export default async function WorkersPage() {
	const workers = await db
		.select()
		.from(worker)
		.orderBy(desc(worker.createdAt));

	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			<WorkersTable initialWorkers={workers} />
		</div>
	);
}
