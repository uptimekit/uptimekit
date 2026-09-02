import { auth } from "@uptimekit/auth";
import type { Route } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OrganizationPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        redirect("/login");
    }

    const activeOrganizationId = session.session.activeOrganizationId;

    if (!activeOrganizationId) {
        redirect("/settings");
    }

    redirect(`/organization/${activeOrganizationId}/settings` as Route);
}
