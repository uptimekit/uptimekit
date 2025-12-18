"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { setUserPassword } from "@/lib/actions/auth-actions";
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

const setPasswordSchema = z
	.object({
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

const changePasswordSchema = z
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
		<div className="flex flex-1 flex-col py-8">
			<div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">
						Account Settings
					</h1>
					<p className="text-muted-foreground">
						Manage your account details and security.
					</p>
				</div>

				<Tabs defaultValue="general" className="w-full gap-6">
					<TabsList className="flex h-auto w-full flex-wrap items-center justify-start gap-6 rounded-none border-border/40 border-b bg-transparent p-0 px-1 pt-2">
						<TabsTrigger
							value="general"
							className="relative h-auto flex-none rounded-none border-0 bg-transparent px-0 pb-3 font-medium text-muted-foreground text-sm shadow-none transition-colors hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:h-[2px] data-[state=active]:after:w-full data-[state=active]:after:bg-primary"
						>
							General
						</TabsTrigger>
						<TabsTrigger
							value="security"
							className="relative h-auto flex-none rounded-none border-0 bg-transparent px-0 pb-3 font-medium text-muted-foreground text-sm shadow-none transition-colors hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:h-[2px] data-[state=active]:after:w-full data-[state=active]:after:bg-primary"
						>
							Security
						</TabsTrigger>
					</TabsList>

					<TabsContent value="general" className="mt-6">
						<ProfileSettings session={session} />
					</TabsContent>

					<TabsContent value="security" className="mt-6 space-y-6">
						<TwoFactorSettings session={session} />
						<PasswordSettings />
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}

function ProfileSettings({ session }: { session: any }) {
	const profileForm = useForm<z.infer<typeof profileFormSchema>>({
		resolver: zodResolver(profileFormSchema),
		defaultValues: {
			name: session.user.name,
			image: session.user.image || "",
		},
	});

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

	return (
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
	);
}

function PasswordSettings() {
	const [hasPassword, setHasPassword] = useState<boolean | null>(null);

	// Check if user has a password set
	useEffect(() => {
		authClient.listAccounts().then((res) => {
			if (res.data) {
				const hasCredential = res.data.some(
					(acc) => acc.providerId === "credential",
				);
				setHasPassword(hasCredential);
			}
		});
	}, []);

	if (hasPassword === null) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Password</CardTitle>
					<CardDescription>Loading password settings...</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	return <PasswordForm hasPassword={hasPassword} />;
}

function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
	const schema = hasPassword ? changePasswordSchema : setPasswordSchema;
	const passwordForm = useForm<z.infer<typeof changePasswordSchema>>({
		resolver: zodResolver(schema) as any,
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		},
	});

	async function onPasswordSubmit(
		values: z.infer<typeof changePasswordSchema>,
	) {
		if (!hasPassword) {
			const res = await setUserPassword(values.newPassword);
			if (res.success) {
				toast.success("Password set successfully");
				passwordForm.reset();
				// Ideally reload window or re-fetch accounts to update state,
				// but simplistic approach:
				window.location.reload();
			} else {
				toast.error(res.error || "Failed to set password");
			}
			return;
		}

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

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					{hasPassword ? "Change Password" : "Set Password"}
				</CardTitle>
				<CardDescription>
					{hasPassword
						? "Update your password."
						: "Set a password to login with email."}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...passwordForm}>
					<form
						onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
						className="space-y-4"
					>
						{hasPassword && (
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
						)}
						{hasPassword && <Separator />}
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
							<Button type="submit">
								{hasPassword ? "Update Password" : "Set Password"}
							</Button>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
}

function TwoFactorSettings({ session }: { session: any }) {
	const [isOpen, setIsOpen] = useState(false);
	const [password, setPassword] = useState("");
	const [totpURI, setTotpURI] = useState("");
	const [verificationCode, setVerificationCode] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [backupCodes, setBackupCodes] = useState<string[]>([]);
	const [step, setStep] = useState<"password" | "qr" | "backup">("password");

	const handleEnableTwoFactor = async () => {
		setIsSubmitting(true);
		try {
			const res = await authClient.twoFactor.enable(
				{
					password,
				},
				{
					onError: (ctx) => {
						toast.error(ctx.error.message);
					},
				},
			);

			if (res.data) {
				setTotpURI(res.data.totpURI);
				setBackupCodes(res.data.backupCodes || []);
				setStep("qr");
				setPassword("");
			}
		} catch (e) {
			console.error(e);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleVerifyTwoFactor = async () => {
		setIsSubmitting(true);
		try {
			await authClient.twoFactor.verifyTotp(
				{
					code: verificationCode,
				},
				{
					onSuccess: () => {
						toast.success("Two-factor authentication enabled");
						setStep("backup");
					},
					onError: (ctx) => {
						toast.error(ctx.error.message);
					},
				},
			);
		} catch (e) {
			console.error(e);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDisableTwoFactor = async () => {
		// Implement disable logic with password prompt if needed.
		// For simplicity, we might just call disable if better-auth allows it, or need password.
		// Better auth 'disable' usually requires password.
		// We'll use a simple prompt for now or expand this component.
		// Given complexity limit, I'll assume we can call disable or reuse the dialog.
		toast.info("Disabling 2FA...");
		await authClient.twoFactor.disable(
			{
				password: password, // We need to ask for password again.
			},
			{
				onSuccess: () => {
					toast.success("Two-factor authentication disabled");
					setIsOpen(false);
				},
				onError: (ctx) => {
					toast.error(ctx.error.message);
				},
			},
		);
	};

	// Reset state when closing/opening
	const onOpenChange = (open: boolean) => {
		setIsOpen(open);
		if (!open) {
			setPassword("");
			setVerificationCode("");
			setStep("password");
		}
	};

	if (session.user.twoFactorEnabled && step !== "backup") {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Two-Factor Authentication</CardTitle>
					<CardDescription>
						Add an extra layer of security to your account.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Check className="h-4 w-4 text-green-500" />
							<span className="font-medium">
								Two-factor authentication is enabled.
							</span>
						</div>
						<Button variant="destructive" onClick={() => setIsOpen(true)}>
							Disable 2FA
						</Button>
					</div>
				</CardContent>

				<Dialog open={isOpen} onOpenChange={onOpenChange}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Disable Two-Factor Authentication</DialogTitle>
							<DialogDescription>
								Enter your password to disable two-factor authentication.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<div className="space-y-2">
								<Label>Password</Label>
								<Input
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
								/>
							</div>
						</div>
						<DialogFooter>
							<Button variant="outline" onClick={() => setIsOpen(false)}>
								Cancel
							</Button>
							<Button
								variant="destructive"
								onClick={handleDisableTwoFactor}
								disabled={!password || isSubmitting}
							>
								{isSubmitting ? "Disabling..." : "Disable 2FA"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Two-Factor Authentication</CardTitle>
				<CardDescription>
					Add an extra layer of security to your account.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground text-sm">
						Two-factor authentication is currently disabled.
					</span>
					<Button onClick={() => setIsOpen(true)}>Enable 2FA</Button>
				</div>
			</CardContent>

			<Dialog open={isOpen} onOpenChange={onOpenChange}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{step === "password" && "Enable Two-Factor Authentication"}
							{step === "qr" && "Scan QR Code"}
							{step === "backup" && "Backup Codes"}
						</DialogTitle>
						<DialogDescription>
							{step === "password" && "Enter your password to continue."}
							{step === "qr" && "Scan the QR code with your authenticator app."}
							{step === "backup" && "Save these backup codes in a safe place."}
						</DialogDescription>
					</DialogHeader>

					<div className="py-4">
						{step === "password" && (
							<div className="space-y-2">
								<Label>Password</Label>
								<Input
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
								/>
							</div>
						)}

						{step === "qr" && (
							<div className="flex flex-col items-center gap-4">
								<div className="overflow-hidden rounded-lg border bg-white p-2">
									{/* Use external API for QR code generation to avoid new dependencies */}
									<img
										src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpURI)}`}
										alt="QR Code"
										className="h-48 w-48"
									/>
								</div>
								<div className="w-full space-y-2">
									<Label className="block text-center">Verification Code</Label>
									<div className="flex justify-center">
										<InputOTP
											maxLength={6}
											value={verificationCode}
											onChange={setVerificationCode}
										>
											<InputOTPGroup>
												<InputOTPSlot index={0} />
												<InputOTPSlot index={1} />
												<InputOTPSlot index={2} />
											</InputOTPGroup>
											<InputOTPSeparator />
											<InputOTPGroup>
												<InputOTPSlot index={3} />
												<InputOTPSlot index={4} />
												<InputOTPSlot index={5} />
											</InputOTPGroup>
										</InputOTP>
									</div>
								</div>
							</div>
						)}

						{step === "backup" && (
							<div className="space-y-4">
								<div className="grid grid-cols-2 gap-2">
									{backupCodes.map((code) => (
										<div
											key={code}
											className="rounded bg-muted p-2 text-center font-mono text-sm"
										>
											{code}
										</div>
									))}
								</div>
								<Button
									variant="outline"
									className="w-full"
									onClick={() => {
										navigator.clipboard.writeText(backupCodes.join("\n"));
										toast.success("Copied to clipboard");
									}}
								>
									<Copy className="mr-2 h-4 w-4" /> Copy Codes
								</Button>
							</div>
						)}
					</div>

					<DialogFooter>
						{step === "password" && (
							<Button
								onClick={handleEnableTwoFactor}
								disabled={!password || isSubmitting}
							>
								{isSubmitting ? "Verifying..." : "Continue"}
							</Button>
						)}
						{step === "qr" && (
							<Button
								onClick={handleVerifyTwoFactor}
								disabled={verificationCode.length < 6 || isSubmitting}
							>
								{isSubmitting ? "Activating..." : "Activate"}
							</Button>
						)}
						{step === "backup" && (
							<Button onClick={() => onOpenChange(false)}>Done</Button>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
