import { redirect } from "next/navigation";

export default async function MaintenanceDetailsPage({
    params,
}: {
    params: Promise<{ maintenanceId: string }>;
}) {
    const { maintenanceId } = await params;

    redirect(`/incidents/${maintenanceId}`);
}
