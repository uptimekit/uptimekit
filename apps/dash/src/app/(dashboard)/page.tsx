import { auth } from "@uptimekit/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { IncidentsTable } from "@/components/incidents/table";

export default async function HomePage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user) {
		redirect("/login");
	}

	return (
		<div className="flex flex-1 flex-col py-8">
			<IncidentsTable />
		</div>
	);
}
