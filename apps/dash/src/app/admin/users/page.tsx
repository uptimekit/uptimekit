import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export default function AdminUsersPage() {
	return (
		<div className="flex flex-col gap-6 p-4">
			<div>
				<h1 className="font-bold text-3xl tracking-tight">User Management</h1>
				<p className="text-muted-foreground">
					View and manage all registered users.
				</p>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Users</CardTitle>
					<CardDescription>List of all users in the system.</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-center rounded-lg border-2 border-dashed p-8 text-muted-foreground">
						User management table coming soon...
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
