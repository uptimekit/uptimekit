import { StatusBadgeSettings } from "./status-badge-settings";

export default async function StatusBadgePage({
    params,
}: {
    params: Promise<{ statusPageId: string }>;
}) {
    const { statusPageId } = await params;

    return <StatusBadgeSettings statusPageId={statusPageId} />;
}
