"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface PasswordFormProps {
	statusPageId: string;
	redirectUrl: string;
}

export function PasswordForm({ statusPageId, redirectUrl }: PasswordFormProps) {
	const router = useRouter();
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setIsLoading(true);

		try {
			const response = await fetch("/api/verify-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ statusPageId, password }),
			});

			const data = await response.json();

			if (!response.ok) {
				setError(data.error || "Invalid password");
				return;
			}

			router.push(redirectUrl as never);
			router.refresh();
		} catch {
			setError("An error occurred. Please try again.");
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<div className="flex min-h-[60vh] items-center justify-center px-4">
			<div className="w-full max-w-sm space-y-6">
				<div className="text-center">
					<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
						<Lock className="h-6 w-6 text-muted-foreground" />
					</div>
					<h1 className="mt-4 font-semibold text-foreground text-xl">
						Password Protected
					</h1>
					<p className="mt-2 text-muted-foreground text-sm">
						This status page is private. Please enter the password to continue.
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label htmlFor="password" className="sr-only">
							Password
						</label>
						<input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Enter password"
							required
							autoFocus
							disabled={isLoading}
							className="block w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
						/>
					</div>

					{error && (
						<div className="rounded-lg bg-destructive/10 px-4 py-3 text-destructive text-sm">
							{error}
						</div>
					)}

					<button
						type="submit"
						disabled={isLoading || !password}
						className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
					>
						{isLoading ? "Verifying..." : "Continue"}
					</button>
				</form>
			</div>
		</div>
	);
}
