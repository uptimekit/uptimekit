"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";

const profileFormSchema = z.object({
	name: z.string().min(2, {
		message: "Name must be at least 2 characters.",
	}),
	image: z
		.string()
		.url({
			message: "Please enter a valid URL.",
		})
		.optional()
		.or(z.literal("")),
});

const passwordFormSchema = z
	.object({
		currentPassword: z.string().min(1, {
			message: "Current password is required.",
		}),
		newPassword: z.string().min(8, {
			message: "Password must be at least 8 characters.",
		}),
		confirmPassword: z.string().min(8, {
			message: "Password must be at least 8 characters.",
		}),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

export default function AccountPage() {
	const { data: session, isPending } = authClient.useSession();

	const profileForm = useForm<z.infer<typeof profileFormSchema>>({
		resolver: zodResolver(profileFormSchema),
		defaultValues: {
			name: "",
			image: "",
		},
	});

	const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
		resolver: zodResolver(passwordFormSchema),
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		},
	});

	useEffect(() => {
		if (session?.user) {
			profileForm.reset({
				name: session.user.name,
				image: session.user.image || "",
			});
		}
	}, [session, profileForm]);

	async function onProfileSubmit(values: z.infer<typeof profileFormSchema>) {
		await authClient.updateUser(
			{
				name: values.name,
				image: values.image || undefined,
			},
			{
				onSuccess: () => {
					toast.success("Profile updated");
				},
				onError: (ctx) => {
					toast.error(ctx.error.message);
				},
			},
		);
	}

	async function onPasswordSubmit(values: z.infer<typeof passwordFormSchema>) {
		await authClient.changePassword(
			{
				currentPassword: values.currentPassword,
				newPassword: values.newPassword,
				revokeOtherSessions: true,
			},
			{
				onSuccess: () => {
					toast.success("Password updated");
					passwordForm.reset();
				},
				onError: (ctx) => {
					toast.error(ctx.error.message);
				},
			},
		);
	}

	if (isPending) {
		return (
			<div className="flex h-full w-full items-center justify-center">
				<div className="text-muted-foreground">Loading...</div>
			</div>
		);
	}

	if (!session) {
		return (
			<div className="flex h-full w-full items-center justify-center">
				<div className="text-muted-foreground">Not authenticated</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="font-bold text-2xl tracking-tight">Account Settings</h1>
				<p className="text-muted-foreground">
					Manage your account details and security.
				</p>
			</div>
			<Separator />

			<Card>
				<CardHeader>
					<CardTitle>Profile</CardTitle>
					<CardDescription>Update your personal information.</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...profileForm}>
						<form
							onSubmit={profileForm.handleSubmit(onProfileSubmit)}
							className="space-y-4"
						>
							<div className="flex items-center gap-4">
								<Avatar className="h-16 w-16">
									<AvatarImage
										src={profileForm.watch("image") || session.user.image || ""}
										alt={session.user.name}
									/>
									<AvatarFallback>
										{session.user.name.slice(0, 2).toUpperCase()}
									</AvatarFallback>
								</Avatar>
							</div>
							<FormField
								control={profileForm.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Name</FormLabel>
										<FormControl>
											<Input placeholder="John Doe" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={profileForm.control}
								name="image"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Avatar URL</FormLabel>
										<FormControl>
											<Input placeholder="https://..." {...field} />
										</FormControl>
										<FormDescription>
											A URL to your profile picture.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<div className="flex justify-end">
								<Button type="submit">Save Profile</Button>
							</div>
						</form>
					</Form>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Security</CardTitle>
					<CardDescription>Update your password.</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...passwordForm}>
						<form
							onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
							className="space-y-4"
						>
							<FormField
								control={passwordForm.control}
								name="currentPassword"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Current Password</FormLabel>
										<FormControl>
											<Input type="password" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<Separator />
							<FormField
								control={passwordForm.control}
								name="newPassword"
								render={({ field }) => (
									<FormItem>
										<FormLabel>New Password</FormLabel>
										<FormControl>
											<Input type="password" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={passwordForm.control}
								name="confirmPassword"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Confirm New Password</FormLabel>
										<FormControl>
											<Input type="password" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<div className="flex justify-end">
								<Button type="submit">Update Password</Button>
							</div>
						</form>
					</Form>
				</CardContent>
			</Card>
		</div>
	);
}
