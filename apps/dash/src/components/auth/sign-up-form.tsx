"use client";

import { faAt, faLock, faUser } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sileo } from "sileo";
import z from "zod";
import { AuthDivider } from "@/components/auth/auth-divider";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@/components/ui/input-group";
import { authClient } from "@/lib/auth-client";
import { DiscordIcon } from "./discord-icon";
import { handleSocialSignIn } from "./social-sign-in";

export default function SignUpForm({
    showLogin = true,
    showDiscordLogin = false,
    showGithubLogin = false,
    onSuccess,
    email,
    emailReadOnly = false,
    fullPage = false,
}: {
    showLogin?: boolean;
    showDiscordLogin?: boolean;
    showGithubLogin?: boolean;
    onSuccess?: () => void;
    email?: string;
    emailReadOnly?: boolean;
    fullPage?: boolean;
}) {
    const router = useRouter();

    const form = useForm({
        defaultValues: {
            email: email || "",
            password: "",
            name: "",
        },
        onSubmit: async ({ value }) => {
            await authClient.signUp.email(
                {
                    email: value.email,
                    password: value.password,
                    name: value.name,
                },
                {
                    onSuccess: () => {
                        if (onSuccess) {
                            onSuccess();
                            return;
                        }
                        router.push("/");
                        sileo.success({ title: "Sign up successful" });
                    },
                    onError: (error) => {
                        sileo.error({
                            title:
                                error.error.message || error.error.statusText,
                        });
                    },
                },
            );
        },
        validators: {
            onSubmit: z.object({
                name: z.string().min(2, "Name must be at least 2 characters"),
                email: z.email("Invalid email address"),
                password: z
                    .string()
                    .min(8, "Password must be at least 8 characters"),
            }),
        },
    });

    const authContent = (
        <div className="fade-in slide-in-from-bottom-4 flex w-full animate-in flex-col gap-4 duration-600">
            {fullPage && (
                <Link href="/" className="flex items-center gap-2">
                    <Logo className="h-6 w-auto" />
                    <span className="font-semibold text-lg">UptimeKit</span>
                </Link>
            )}
            <div className="flex flex-col gap-1">
                <h1 className="font-bold text-2xl tracking-wide">
                    Create Account
                </h1>
                <p className="text-base text-muted-foreground">
                    Enter your information to create an account.
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
                <form.Field name="name">
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
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(e) =>
                                            field.handleChange(e.target.value)
                                        }
                                        placeholder="Name"
                                        aria-invalid={showErrors || undefined}
                                    />
                                    <InputGroupAddon align="inline-start">
                                        <FontAwesomeIcon icon={faUser} />
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

                <form.Field name="email">
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
                                        type="email"
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(e) =>
                                            field.handleChange(e.target.value)
                                        }
                                        placeholder="your.email@example.com"
                                        disabled={emailReadOnly}
                                        aria-invalid={showErrors || undefined}
                                    />
                                    <InputGroupAddon align="inline-start">
                                        <FontAwesomeIcon icon={faAt} />
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
                                        onChange={(e) =>
                                            field.handleChange(e.target.value)
                                        }
                                        placeholder="Password"
                                        aria-invalid={showErrors || undefined}
                                    />
                                    <InputGroupAddon align="inline-start">
                                        <FontAwesomeIcon icon={faLock} />
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

                <form.Subscribe>
                    {(state) => (
                        <Button
                            type="submit"
                            className="w-full"
                            size="sm"
                            disabled={!state.canSubmit || state.isSubmitting}
                        >
                            {state.isSubmitting
                                ? "Creating Account..."
                                : "Sign Up"}
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

                    {showLogin && (
                        <p className="text-center text-muted-foreground text-sm">
                            Already have an account?{" "}
                            <Link
                                href="/login"
                                className="underline underline-offset-4 hover:text-primary"
                            >
                                Sign In
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
            {showLogin && (
                <p className="text-center text-muted-foreground text-sm">
                    Already have an account?{" "}
                    <Link
                        href="/login"
                        className="underline underline-offset-4 hover:text-primary"
                    >
                        Sign In
                    </Link>
                </p>
            )}
        </div>
    );
}

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
