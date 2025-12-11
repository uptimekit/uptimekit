import { redirect } from "next/navigation";
import { IncidentsTable } from "@/components/incidents/table";
import { headers } from "next/headers";
import { auth } from "@uptimekit/auth";

export default async function HomePage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user) {
		redirect("/login");
	}

	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			<IncidentsTable />
		</div>
	);
}
