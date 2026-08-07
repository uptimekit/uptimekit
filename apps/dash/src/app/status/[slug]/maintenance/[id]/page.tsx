import { redirect } from "next/navigation";

export default async function SlugMaintenanceDetailsPage({
    params,
}: {
    params: Promise<{ slug: string; id: string }>;
}) {
    const { slug, id } = await params;

    redirect(`/${slug}/incidents/${id}` as never);
}
