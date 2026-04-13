import { SubscribersTable } from "./subscribers-table";

interface SettingsPageProps {
	params: Promise<{
		statusPageId: string;
	}>;
}

export default async function SubscribersPage({ params }: SettingsPageProps) {
	const { statusPageId } = await params;

	return (
		<div className="space-y-6">
			<SubscribersTable statusPageId={statusPageId} />
		</div>
	);
}
