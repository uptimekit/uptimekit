"use client";

import { format } from "date-fns";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogPanel,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { authClient } from "@/lib/auth-client";

export function MembersTable() {
	const {
		data: activeOrg,
		isPending,
		refetch,
	} = authClient.useActiveOrganization();
	const { data: session } = authClient.useSession();

	const [selectedMember, setSelectedMember] = useState<any>(null);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
	const [newRole, setNewRole] = useState("member");

	const members = activeOrg?.members;

	const handleRemoveMember = async () => {
		if (!selectedMember) return;
		await authClient.organization.removeMember(
			{
				memberIdOrEmail: selectedMember.id,
			},
			{
				onSuccess: () => {
					toast.success("Member removed");
					setIsDeleteDialogOpen(false);
					refetch();
				},
				onError: (ctx) => {
					toast.error(ctx.error.message);
				},
			},
		);
	};

	const handleUpdateRole = async () => {
		if (!selectedMember) return;
		await authClient.organization.updateMemberRole(
			{
				memberId: selectedMember.id,
				role: newRole,
			},
			{
				onSuccess: () => {
					toast.success("Role updated");
					setIsRoleDialogOpen(false);
					refetch();
				},
				onError: (ctx) => {
					toast.error(ctx.error.message);
				},
			},
		);
	};

	if (isPending) {
		return (
			<div className="text-muted-foreground text-sm">Loading members...</div>
		);
	}

	const isOwner =
		members?.find((m) => m.userId === session?.user.id)?.role === "owner";

	return (
		<>
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>User</TableHead>
							<TableHead>Role</TableHead>
							<TableHead>Joined At</TableHead>
							<TableHead className="w-[100px]" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{members?.map((member) => (
							<TableRow key={member.id}>
								<TableCell className="flex items-center gap-3">
									<Avatar className="h-8 w-8">
										<AvatarImage src={member.user.image || ""} />
										<AvatarFallback>
											{member.user.name.charAt(0).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<div className="flex flex-col">
										<span className="font-medium text-sm">
											{member.user.name}
										</span>
										<span className="text-muted-foreground text-xs">
											{member.user.email}
										</span>
									</div>
								</TableCell>
								<TableCell>
									<Badge variant="outline" className="capitalize">
										{member.role}
									</Badge>
								</TableCell>
								<TableCell className="text-muted-foreground text-sm">
									{format(new Date(member.createdAt), "MMM d, yyyy")}
								</TableCell>
								<TableCell>
									{isOwner && member.userId !== session?.user.id && (
										<DropdownMenu>
											<DropdownMenuTrigger
												render={
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8"
													/>
												}
											>
												<MoreHorizontal className="h-4 w-4" />
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem
													onClick={() => {
														setSelectedMember(member);
														setNewRole(member.role);
														setIsRoleDialogOpen(true);
													}}
												>
													Change Role
												</DropdownMenuItem>
												<DropdownMenuItem
													className="text-destructive focus:text-destructive"
													onClick={() => {
														setSelectedMember(member);
														setIsDeleteDialogOpen(true);
													}}
												>
													Remove Member
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									)}
								</TableCell>
							</TableRow>
						))}
						{activeOrg?.invitations
							?.filter((inv) => inv.status === "pending")
							.map((invitation) => (
								<TableRow key={invitation.id}>
									<TableCell className="flex items-center gap-3">
										<Avatar className="h-8 w-8">
											<AvatarFallback>
												{invitation.email.charAt(0).toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<div className="flex flex-col">
											<span className="font-medium text-sm">
												{invitation.email}
											</span>
											<span className="text-muted-foreground text-xs">
												Invited
											</span>
										</div>
									</TableCell>
									<TableCell>
										<Badge variant="secondary" className="capitalize">
											{invitation.role}
										</Badge>
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{format(new Date(invitation.createdAt), "MMM d, yyyy")}
									</TableCell>
									<TableCell>
										{isOwner && (
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8 text-muted-foreground hover:text-destructive"
												onClick={async () => {
													await authClient.organization.cancelInvitation({
														invitationId: invitation.id,
													});
													toast.success("Invitation revoked");
													refetch();
												}}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										)}
									</TableCell>
								</TableRow>
							))}
					</TableBody>
				</Table>
			</div>

			<AlertDialog
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove member?</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to remove{" "}
							<span className="font-medium">{selectedMember?.user.name}</span>{" "}
							from the organization? They will lose access to all resources.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleRemoveMember}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Remove
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Change Role</DialogTitle>
					</DialogHeader>
					<DialogPanel className="space-y-4">
						<div className="space-y-2">
							<Label>Role</Label>
							<Select value={newRole} onValueChange={setNewRole}>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="admin">Admin</SelectItem>
									<SelectItem value="member">Member</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</DialogPanel>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsRoleDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button onClick={handleUpdateRole}>Update Role</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
