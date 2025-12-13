import { SettingsForm } from "./settings-form";

interface SettingsPageProps {
	params: Promise<{
		statusPageId: string;
	}>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
	const { statusPageId } = await params;
	return (
		<div className="space-y-6">
			<SettingsForm statusPageId={statusPageId} />
		</div>
	);
}
