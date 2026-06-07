"use client";

import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sileo } from "sileo";
import z from "zod";
import { AuthDivider } from "@/components/auth/auth-divider";
import { AtSignIcon, LockKeyholeIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { authClient } from "@/lib/auth-client";
import Loader from "../common/loader";

type OidcLookupResponse =
	| { hasProvider: false }
	| {
			hasProvider: true;
			organizationName: string;
			providerId: string;
			providerName: string;
	  };

async function lookupOrganizationOidcProvider(email: string) {
	const response = await fetch("/api/auth/organization-oidc/lookup", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		credentials: "include",
		body: JSON.stringify({ email }),
	});

	if (!response.ok) {
		throw new Error("Unable to check organization sign-in settings");
	}

	return (await response.json()) as OidcLookupResponse;
}

export default function SignInForm({
	showRegister = true,
	showDiscordLogin = false,
	showGithubLogin = false,
	onSuccess,
	email,
	emailReadOnly = false,
	fullPage = false,
}: {
	showRegister?: boolean;
	showDiscordLogin?: boolean;
	showGithubLogin?: boolean;
	onSuccess?: () => void;
	email?: string;
	emailReadOnly?: boolean;
	fullPage?: boolean;
}) {
	const router = useRouter();
	const { isPending } = authClient.useSession();
	const [isPasswordStep, setIsPasswordStep] = useState(false);

	const handleSocialSignIn = async (provider: "discord" | "github") => {
		await authClient.signIn.social({
			provider,
			callbackURL: "/",
		});
	};

	const getCallbackURL = () => {
		if (onSuccess && typeof window !== "undefined") {
			return `${window.location.pathname}${window.location.search}`;
		}

		return "/";
	};

	const form = useForm({
		defaultValues: {
			email: email || "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			const normalizedEmail = value.email.trim().toLowerCase();

			if (!isPasswordStep) {
				try {
					const oidcLookup =
						await lookupOrganizationOidcProvider(normalizedEmail);

					if (oidcLookup.hasProvider) {
						await authClient.signIn.oauth2(
							{
								providerId: oidcLookup.providerId,
								callbackURL: getCallbackURL(),
								errorCallbackURL: "/login",
								additionalData: {
									email: normalizedEmail,
								},
							},
							{
								onError: (error) => {
									sileo.error({
										title:
											error.error.message ||
											`Unable to start ${oidcLookup.providerName} sign-in`,
									});
								},
							},
						);
						return;
					}

					setIsPasswordStep(true);
					return;
				} catch (error) {
					sileo.error({
						title:
							error instanceof Error
								? error.message
								: "Unable to check organization sign-in settings",
					});
					return;
				}
			}

			if (value.password.length < 8) {
				sileo.error({ title: "Password must be at least 8 characters" });
				return;
			}

			await authClient.signIn.email(
				{
					email: normalizedEmail,
					password: value.password,
				},
				{
					onSuccess: (ctx) => {
						if (onSuccess) {
							onSuccess();
							return;
						}

						if (ctx.data.twoFactorRedirect) {
							router.push("/two-factor");
						} else {
							router.push("/");
							sileo.success({ title: "Sign in successful" });
						}
					},
					onError: (error) => {
						sileo.error({
							title: error.error.message || error.error.statusText,
						});
					},
				},
			);
		},
		validators: {
			onSubmit: z.object({
				email: z.email("Invalid email address"),
				password: z.string(),
			}),
		},
	});

	if (isPending) {
		return <Loader />;
	}

	const authContent = (
		<div className="fade-in slide-in-from-bottom-4 flex w-full animate-in flex-col gap-4 duration-600">
			{fullPage && (
				<Link href="/" className="flex items-center gap-2">
					<Logo className="h-10 w-auto" />
					<span className="font-semibold text-lg">UptimeKit</span>
				</Link>
			)}
			<div className="flex flex-col gap-1">
				<h1 className="font-bold text-2xl tracking-wide">Welcome Back</h1>
				<p className="text-base text-muted-foreground">
					{isPasswordStep
						? "Enter your password to access your account."
						: "Enter your email to continue."}
				</p>
			</div>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				className="flex flex-col gap-2"
			>
				<form.Field name="email">
					{(field) => {
						const showErrors =
							field.state.meta.isTouched && field.state.meta.errors.length > 0;

						return (
							<div className="flex flex-col gap-1.5">
								<InputGroup>
									<InputGroupInput
										id={field.name}
										name={field.name}
										type="email"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => {
											field.handleChange(e.target.value);
											setIsPasswordStep(false);
										}}
										placeholder="your.email@example.com"
										disabled={emailReadOnly}
										aria-invalid={showErrors || undefined}
									/>
									<InputGroupAddon align="inline-start">
										<AtSignIcon />
									</InputGroupAddon>
								</InputGroup>
								{showErrors &&
									field.state.meta.errors.map((error) => (
										<p
											key={error?.message}
											className="font-medium text-destructive text-sm"
										>
											{error?.message}
										</p>
									))}
							</div>
						);
					}}
				</form.Field>

				{isPasswordStep && (
					<form.Field name="password">
						{(field) => {
							const showErrors =
								field.state.meta.isTouched &&
								field.state.meta.errors.length > 0;

							return (
								<div className="flex flex-col gap-1.5">
									<InputGroup>
										<InputGroupInput
											id={field.name}
											name={field.name}
											type="password"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="Password"
											aria-invalid={showErrors || undefined}
										/>
										<InputGroupAddon align="inline-start">
											<LockKeyholeIcon />
										</InputGroupAddon>
									</InputGroup>
									{showErrors &&
										field.state.meta.errors.map((error) => (
											<p
												key={error?.message}
												className="font-medium text-destructive text-sm"
											>
												{error?.message}
											</p>
										))}
								</div>
							);
						}}
					</form.Field>
				)}

				<form.Subscribe>
					{(state) => (
						<Button
							type="submit"
							className="mt-3 w-full"
							size="sm"
							disabled={!state.canSubmit || state.isSubmitting}
						>
							{state.isSubmitting
								? isPasswordStep
									? "Signing In..."
									: "Continuing..."
								: isPasswordStep
									? "Sign In"
									: "Continue"}
						</Button>
					)}
				</form.Subscribe>
			</form>

			{(showDiscordLogin || showGithubLogin) && (
				<>
					<AuthDivider>OR CONTINUE WITH</AuthDivider>
					<div className="flex flex-col gap-2">
						{showDiscordLogin && (
							<Button
								variant="outline"
								className="w-full"
								onClick={() => handleSocialSignIn("discord")}
								type="button"
							>
								<DiscordIcon data-icon="inline-start" />
								Discord
							</Button>
						)}
						{showGithubLogin && (
							<Button
								variant="outline"
								className="w-full"
								onClick={() => handleSocialSignIn("github")}
								type="button"
							>
								<GithubIcon data-icon="inline-start" />
								GitHub
							</Button>
						)}
					</div>
				</>
			)}
		</div>
	);

	if (fullPage) {
		return (
			<div className="relative w-full overflow-hidden md:h-screen">
				<div className="relative mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-8 p-6 md:p-8">
					{authContent}

					{showRegister && (
						<p className="text-center text-muted-foreground text-sm">
							Don&apos;t have an account?{" "}
							<Link
								href="/register"
								className="underline underline-offset-4 hover:text-primary"
							>
								Sign Up
							</Link>
						</p>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto flex w-full max-w-sm flex-col gap-4">
			{authContent}
			{showRegister && (
				<p className="text-center text-muted-foreground text-sm">
					Don&apos;t have an account?{" "}
					<Link
						href="/register"
						className="underline underline-offset-4 hover:text-primary"
					>
						Sign Up
					</Link>
				</p>
			)}
		</div>
	);
}

const DiscordIcon = (props: React.ComponentProps<"svg">) => (
	<svg
		role="img"
		viewBox="0 0 24 24"
		xmlns="http://www.w3.org/2000/svg"
		fill="currentColor"
		{...props}
	>
		<title>Discord</title>
		<path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z" />
	</svg>
);

const GithubIcon = (props: React.ComponentProps<"svg">) => (
	<svg role="img" fill="currentColor" viewBox="0 0 1024 1024" {...props}>
		<title>GitHub</title>
		<path
			clipRule="evenodd"
			d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z"
			fillRule="evenodd"
			transform="scale(64)"
		/>
	</svg>
);
