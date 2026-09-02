import { OrganizationSettingsClient } from "@/components/settings/organization-settings-client";

interface OrganizationSettingsPageProps {
    params: Promise<{
        organizationId: string;
    }>;
}

export default async function OrganizationSettingsPage({
    params,
}: OrganizationSettingsPageProps) {
    const { organizationId } = await params;

    return <OrganizationSettingsClient organizationId={organizationId} />;
}
