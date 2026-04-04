"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";

const formSchema = z.object({
	email: z.string().email(),
	role: z.enum(["member", "admin"]),
});

export function InviteMemberDialog() {
	const [isOpen, setIsOpen] = useState(false);
	const [inviteLink, setInviteLink] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: "",
			role: "member",
		},
	});

	const onSubmit = async (values: z.infer<typeof formSchema>) => {
		const { data, error } = await authClient.organization.inviteMember({
			email: values.email,
			role: values.role as "member" | "admin",
		});

		if (error) {
			toast.error(error.message || error.statusText);
			return;
		}

		if (data) {
			const link = `${window.location.origin}/invite/${data.id}`;
			setInviteLink(link);
			toast.success("Invitation created");
		}
	};

	const copyLink = () => {
		if (inviteLink) {
			navigator.clipboard.writeText(inviteLink);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
			toast.success("Link copied to clipboard");
		}
	};

	const reset = () => {
		setIsOpen(false);
		setInviteLink(null);
		form.reset();
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger render={<Button />}>
				<Plus className="mr-2 h-4 w-4" />
				Add Member
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Invite Team Member</DialogTitle>
					<DialogDescription>
						Invite a new member to your organization. They will receive an email
						or you can share the link directly.
					</DialogDescription>
				</DialogHeader>

				{!inviteLink ? (
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
							<FormField
								control={form.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Email</FormLabel>
										<FormControl>
											<Input placeholder="colleague@example.com" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="role"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Role</FormLabel>
										<Select
											onValueChange={field.onChange}
											defaultValue={field.value}
										>
											<FormControl>
												<SelectTrigger className="w-full">
													<SelectValue placeholder="Select a role" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="member">Member</SelectItem>
												<SelectItem value="admin">Admin</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
							<DialogFooter>
								<Button type="submit" disabled={form.formState.isSubmitting}>
									{form.formState.isSubmitting && (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									)}
									Create Invite
								</Button>
							</DialogFooter>
						</form>
					</Form>
				) : (
					<div className="space-y-4">
						<div className="rounded-md border bg-muted p-4">
							<div className="mb-2 font-medium text-sm">Invitation Link</div>
							<div className="flex items-center gap-2">
								<code className="flex-1 whitespace-normal break-all rounded bg-background p-2 font-mono text-xs">
									{inviteLink}
								</code>
								<Button size="icon" variant="outline" onClick={copyLink}>
									{copied ? (
										<Check className="h-4 w-4" />
									) : (
										<Copy className="h-4 w-4" />
									)}
								</Button>
							</div>
						</div>
						<DialogFooter>
							<Button variant="outline" onClick={() => setInviteLink(null)}>
								Invite Another
							</Button>
							<Button onClick={reset}>Done</Button>
						</DialogFooter>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
