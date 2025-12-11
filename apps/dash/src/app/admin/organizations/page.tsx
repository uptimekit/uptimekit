import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export default function AdminOrgsPage() {
	return (
		<div className="flex flex-col gap-6 p-4">
			<div>
				<h1 className="font-bold text-3xl tracking-tight">
					Organization Management
				</h1>
				<p className="text-muted-foreground">
					View and manage all organizations.
				</p>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Organizations</CardTitle>
					<CardDescription>System-wide organizations list.</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-center rounded-lg border-2 border-dashed p-8 text-muted-foreground">
						Organization management table coming soon...
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
