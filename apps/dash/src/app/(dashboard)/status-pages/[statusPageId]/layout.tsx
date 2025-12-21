import type { ReactNode } from "react";
import { StatusPageNav } from "./nav";

export default async function StatusPageLayout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ statusPageId: string }>;
}) {
	const { statusPageId } = await params;
	return (
		<div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 p-8">
			<div className="space-y-2">
				<h1 className="font-bold text-3xl tracking-tight">
					Status Page Settings
				</h1>
				<p className="text-muted-foreground">
					Manage your public status page configuration
				</p>
			</div>

			<div className="flex flex-col gap-6">
				<StatusPageNav statusPageId={statusPageId} />
				{children}
			</div>
		</div>
	);
}
