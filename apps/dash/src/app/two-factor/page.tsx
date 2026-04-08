"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export default function TwoFactorPage() {
	const router = useRouter();
	const [twoFactorCode, setTwoFactorCode] = useState("");
	const [backupCode, setBackupCode] = useState("");
	const [isVerifying, setIsVerifying] = useState(false);
	const [method, setMethod] = useState<"totp" | "backup">("totp");

	const handleTwoFactorSubmit = async () => {
		const code = method === "totp" ? twoFactorCode : backupCode;
		if (code.length < 6) return;

		setIsVerifying(true);
		try {
			if (method === "totp") {
				await authClient.twoFactor.verifyTotp(
					{
						code,
					},
					{
						onSuccess: () => {
							router.push("/");
							sileo.success({ title: "Two-factor authentication verified" });
						},
						onError: (ctx) => {
							if (ctx.error.message === "Invalid 2FA token") {
								router.push("/login");
								sileo.error({
									title: "Invalid 2FA session, please login again",
								});
							} else {
								sileo.error({ title: ctx.error.message });
							}
						},
					},
				);
			} else {
				await authClient.twoFactor.verifyBackupCode(
					{
						code,
					},
					{
						onSuccess: () => {
							router.push("/");
							sileo.success({ title: "Two-factor authentication verified" });
						},
						onError: (ctx) => {
							if (ctx.error.message === "Invalid 2FA token") {
								router.push("/login");
								sileo.error({
									title: "Invalid 2FA session, please login again",
								});
							} else {
								sileo.error({ title: ctx.error.message });
							}
						},
					},
				);
			}
		} catch (_) {
			sileo.error({ title: "Failed to verify code" });
		} finally {
			setIsVerifying(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="mx-auto w-full max-w-md">
				<CardHeader>
					<CardTitle className="font-bold text-2xl">
						Two-Factor Authentication
					</CardTitle>
					<CardDescription>
						{method === "totp"
							? "Enter the code from your authenticator app to continue."
							: "Enter one of your recovery codes to continue."}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col gap-4 py-4">
						{method === "totp" ? (
							<div className="flex justify-center">
								<InputOTP
									maxLength={6}
									value={twoFactorCode}
									onChange={setTwoFactorCode}
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
						) : (
							<div className="space-y-2">
								<Label htmlFor="backup-code">Backup Code</Label>
								<Input
									id="backup-code"
									placeholder="XXXX-XXXX-XXXX"
									value={backupCode}
									onChange={(e) => setBackupCode(e.target.value)}
								/>
							</div>
						)}

						<div className="text-center">
							<Button
								variant="link"
								className="text-muted-foreground text-sm"
								onClick={() => setMethod(method === "totp" ? "backup" : "totp")}
							>
								{method === "totp"
									? "Use a backup code instead"
									: "Use authenticator app instead"}
							</Button>
						</div>
					</div>
				</CardContent>
				<CardFooter>
					<Button
						className="w-full"
						onClick={handleTwoFactorSubmit}
						disabled={
							isVerifying ||
							(method === "totp"
								? twoFactorCode.length < 6
								: backupCode.length < 6)
						}
					>
						{isVerifying ? "Verifying..." : "Verify"}
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
