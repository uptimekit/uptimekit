"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { InviteMemberDialog } from "./invite-member-dialog";
import { MembersTable } from "./members-table";

export function TeamSettings() {
	return (
		<div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
			<div className="space-y-2">
				<h2 className="font-semibold text-lg leading-none tracking-tight">
					Team Members
				</h2>
				<p className="text-muted-foreground text-sm">
					Manage who has access to this organization.
				</p>
			</div>

			<Card className="md:col-span-2">
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
					<div className="space-y-1">
						<CardTitle>Members</CardTitle>
						<CardDescription>
							People with access to this organization.
						</CardDescription>
					</div>
					<InviteMemberDialog />
				</CardHeader>
				<CardContent>
					<MembersTable />
				</CardContent>
			</Card>
		</div>
	);
}
