import { WorkersTable } from "@/components/admin/workers-table";

export default function WorkersPage() {
	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			<WorkersTable />
		</div>
	);
}
