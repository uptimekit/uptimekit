import { auth } from "@uptimekit/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { IncidentsTable } from "@/components/incidents/table";

// Disable prerendering - this page needs auth at runtime
export const dynamic = "force-dynamic";

export default async function HomePage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user) {
		redirect("/login");
	}

	return (
		<div className="flex flex-1 flex-col pb-8">
			<IncidentsTable />
		</div>
	);
}
