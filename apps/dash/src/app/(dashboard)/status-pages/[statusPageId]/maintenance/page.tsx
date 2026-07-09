import { redirect } from "next/navigation";

export default async function MaintenancePage({
    params,
}: {
    params: Promise<{ statusPageId: string }>;
}) {
    const { statusPageId } = await params;

    redirect(`/incidents?statusPageId=${statusPageId}&severity=maintenance`);
}
