import { IncidentDetails } from "@/components/incidents/details";

export default async function IncidentDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	return <IncidentDetails id={(await params).id} />;
}
