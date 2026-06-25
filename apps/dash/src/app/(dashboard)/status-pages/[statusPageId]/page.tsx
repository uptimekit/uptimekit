import { redirect } from "next/navigation";

interface StatusPagesPageProps {
    params: Promise<{
        statusPageId: string;
    }>;
}

export default async function StatusPages({ params }: StatusPagesPageProps) {
    const { statusPageId } = await params;
    return redirect(`/status-pages/${statusPageId}/settings`);
}
