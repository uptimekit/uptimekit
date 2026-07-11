"use client";

import { faCheck, faCopy } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { sileo } from "sileo";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogPanel,
    DialogTitle,
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
import { AvatarEditor } from "../account/avatar-editor";

const profileFormSchema = z.object({
    name: z.string().min(2, {
        message: "Name must be at least 2 characters.",
    }),
    image: z
        .url({
            message: "Please enter a valid URL.",
        })
        .optional()
        .or(z.literal("")),
});

async function submitProfile(values: z.infer<typeof profileFormSchema>) {
    await authClient.updateUser(
        {
            name: values.name,
            image: values.image || "",
        },
        {
            onSuccess: () => {
                sileo.success({ title: "Profile updated" });
            },
            onError: (ctx) => {
                sileo.error({ title: ctx.error.message });
            },
        },
    );
}

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

export default function SettingsPage() {
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
        <div className="flex flex-1 flex-col py-8 pb-20">
            <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4">
                <div>
                    <h1 className="font-bold text-2xl tracking-tight">
                        Settings
                    </h1>
                    <p className="text-muted-foreground">
                        Manage your account details and security.
                    </p>
                </div>

                <Tabs defaultValue="general" className={"space-y-4"}>
                    <TabsList variant="underline">
                        <TabsTrigger value="general">General</TabsTrigger>
                        <TabsTrigger value="security">Security</TabsTrigger>
                    </TabsList>

                    <TabsContent value="general">
                        <ProfileSettings session={session} />
                    </TabsContent>

                    <TabsContent value="security" className="space-y-10">
                        <TwoFactorSettings session={session} />
                        <Separator />
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

    return (
        <Form {...profileForm}>
            <form
                onSubmit={profileForm.handleSubmit(submitProfile)}
                className="space-y-10"
            >
                {/* Public Profile Section */}
                <div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
                    <div className="space-y-2">
                        <h2 className="font-semibold text-lg leading-none tracking-tight">
                            Public Profile
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Update your public information.
                        </p>
                    </div>

                    <Card className="md:col-span-2">
                        <CardContent className="grid gap-6 p-6">
                            <FormField
                                control={profileForm.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem className="flex h-full flex-col">
                                        <FormLabel className="flex h-6 items-end pb-1">
                                            Name
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="John Doe"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>
                </div>

                <Separator />

                {/* Avatar Section */}
                <div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
                    <div className="space-y-2">
                        <h2 className="font-semibold text-lg leading-none tracking-tight">
                            Avatar
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            This is your avatar. Click on the avatar to upload a
                            custom one from a link.
                        </p>
                    </div>

                    <Card className="md:col-span-2">
                        <CardContent className="grid gap-6 p-6">
                            <FormField
                                control={profileForm.control}
                                name="image"
                                render={({ field }) => (
                                    <FormItem>
                                        {/* <FormLabel>Avatar</FormLabel> */}
                                        <FormControl>
                                            <div className="flex items-center gap-4">
                                                <AvatarEditor
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    name={session.user.name}
                                                />
                                                <div className="text-muted-foreground text-sm">
                                                    <p>
                                                        Upload a profile
                                                        picture.
                                                    </p>
                                                    <p className="text-xs">
                                                        Recommended size:
                                                        256x256px.
                                                    </p>
                                                </div>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>
                </div>

                <div className="flex justify-end">
                    <Button type="submit">Save Profile</Button>
                </div>
            </form>
        </Form>
    );
}

function PasswordSettings() {
    const [hasPassword, setHasPassword] = useState<boolean | null>(null);

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
            <div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
                <div className="space-y-2">
                    <h2 className="font-semibold text-lg leading-none tracking-tight">
                        Password
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Manage your password settings.
                    </p>
                </div>
                <Card className="md:col-span-2">
                    <CardContent className="p-6">
                        <div className="text-muted-foreground text-sm">
                            Loading...
                        </div>
                    </CardContent>
                </Card>
            </div>
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
                sileo.success({ title: "Password set successfully" });
                passwordForm.reset();
                window.location.reload();
            } else {
                sileo.error({ title: res.error || "Failed to set password" });
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
                    sileo.success({ title: "Password updated" });
                    passwordForm.reset();
                },
                onError: (ctx) => {
                    sileo.error({ title: ctx.error.message });
                },
            },
        );
    }

    return (
        <div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
            <div className="space-y-2">
                <h2 className="font-semibold text-lg leading-none tracking-tight">
                    Password
                </h2>
                <p className="text-muted-foreground text-sm">
                    {hasPassword
                        ? "Change your password securely."
                        : "Set a password to login via email."}
                </p>
            </div>

            <Card className="md:col-span-2">
                <CardContent className="p-6">
                    <Form {...passwordForm}>
                        <form
                            onSubmit={passwordForm.handleSubmit(
                                onPasswordSubmit,
                            )}
                            className="space-y-4"
                        >
                            {hasPassword && (
                                <FormField
                                    control={passwordForm.control}
                                    name="currentPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Current Password
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="password"
                                                    {...field}
                                                />
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
                                        <FormLabel>
                                            Confirm New Password
                                        </FormLabel>
                                        <FormControl>
                                            <Input type="password" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="flex justify-end">
                                <Button type="submit">
                                    {hasPassword
                                        ? "Update Password"
                                        : "Set Password"}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
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
                        sileo.error({ title: ctx.error.message });
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
        }
        setIsSubmitting(false);
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
                        sileo.success({
                            title: "Two-factor authentication enabled",
                        });
                        setStep("backup");
                    },
                    onError: (ctx) => {
                        sileo.error({ title: ctx.error.message });
                    },
                },
            );
        } catch (e) {
            console.error(e);
        }
        setIsSubmitting(false);
    };

    const handleDisableTwoFactor = async () => {
        sileo.info({ title: "Disabling 2FA..." });
        await authClient.twoFactor.disable(
            {
                password: password,
            },
            {
                onSuccess: () => {
                    sileo.success({
                        title: "Two-factor authentication disabled",
                    });
                    setIsOpen(false);
                },
                onError: (ctx) => {
                    sileo.error({ title: ctx.error.message });
                },
            },
        );
    };

    const onOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) {
            setPassword("");
            setVerificationCode("");
            setStep("password");
        }
    };

    return (
        <div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
            <div className="space-y-2">
                <h2 className="font-semibold text-lg leading-none tracking-tight">
                    Two-Factor Authentication
                </h2>
                <p className="text-muted-foreground text-sm">
                    Add an extra layer of security to your account.
                </p>
            </div>

            <Card className="md:col-span-2">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        {session.user.twoFactorEnabled ? (
                            <div className="flex items-center gap-2">
                                <FontAwesomeIcon
                                    icon={faCheck}
                                    className="h-4 w-4 text-green-500"
                                />
                                <span className="font-medium">
                                    Two-factor authentication is enabled.
                                </span>
                            </div>
                        ) : (
                            <span className="text-muted-foreground text-sm">
                                Two-factor authentication is currently disabled.
                            </span>
                        )}

                        <Button
                            variant={
                                session.user.twoFactorEnabled
                                    ? "destructive"
                                    : "default"
                            }
                            onClick={() => setIsOpen(true)}
                        >
                            {session.user.twoFactorEnabled
                                ? "Disable 2FA"
                                : "Enable 2FA"}
                        </Button>
                    </div>

                    <Dialog open={isOpen} onOpenChange={onOpenChange}>
                        <DialogContent>
                            {session.user.twoFactorEnabled ? (
                                <DisableTwoFactorDialog
                                    password={password}
                                    isSubmitting={isSubmitting}
                                    setPassword={setPassword}
                                    onCancel={() => onOpenChange(false)}
                                    onDisable={handleDisableTwoFactor}
                                />
                            ) : (
                                <EnableTwoFactorDialog
                                    step={step}
                                    password={password}
                                    totpURI={totpURI}
                                    verificationCode={verificationCode}
                                    backupCodes={backupCodes}
                                    isSubmitting={isSubmitting}
                                    setPassword={setPassword}
                                    setVerificationCode={setVerificationCode}
                                    onContinue={handleEnableTwoFactor}
                                    onVerify={handleVerifyTwoFactor}
                                    onDone={() => onOpenChange(false)}
                                />
                            )}
                        </DialogContent>
                    </Dialog>
                </CardContent>
            </Card>
        </div>
    );
}

type EnableTwoFactorDialogProps = {
    step: "password" | "qr" | "backup";
    password: string;
    totpURI: string;
    verificationCode: string;
    backupCodes: string[];
    isSubmitting: boolean;
    setPassword: (password: string) => void;
    setVerificationCode: (code: string) => void;
    onContinue: () => void;
    onVerify: () => void;
    onDone: () => void;
};

function EnableTwoFactorDialog({
    step,
    password,
    totpURI,
    verificationCode,
    backupCodes,
    isSubmitting,
    setPassword,
    setVerificationCode,
    onContinue,
    onVerify,
    onDone,
}: EnableTwoFactorDialogProps) {
    return (
        <>
            <DialogHeader>
                <DialogTitle>
                    {step === "password" && "Enable Two-Factor Authentication"}
                    {step === "qr" && "Scan QR Code"}
                    {step === "backup" && "Backup Codes"}
                </DialogTitle>
                <DialogDescription>
                    {step === "password" && "Enter your password to continue."}
                    {step === "qr" &&
                        "Scan the QR code with your authenticator app."}
                    {step === "backup" &&
                        "Save these backup codes in a safe place."}
                </DialogDescription>
            </DialogHeader>
            <DialogPanel>
                {step === "password" && (
                    <div className="space-y-2">
                        <Label>Password</Label>
                        <Input
                            type="password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                        />
                    </div>
                )}
                {step === "qr" && (
                    <div className="flex flex-col items-center gap-4">
                        <div className="overflow-hidden rounded-lg border bg-white p-2">
                            <Image
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpURI)}`}
                                alt="QR Code"
                                width={200}
                                height={200}
                                className="h-48 w-48"
                            />
                        </div>
                        <div className="w-full space-y-2">
                            <Label className="block text-center">
                                Verification Code
                            </Label>
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
                                navigator.clipboard.writeText(
                                    backupCodes.join("\n"),
                                );
                                sileo.success({
                                    title: "Copied to clipboard",
                                });
                            }}
                        >
                            <FontAwesomeIcon
                                icon={faCopy}
                                className="mr-2 h-4 w-4"
                            />{" "}
                            Copy Codes
                        </Button>
                    </div>
                )}
            </DialogPanel>
            <DialogFooter>
                {step === "password" && (
                    <Button
                        onClick={onContinue}
                        disabled={!password || isSubmitting}
                    >
                        {isSubmitting ? "Verifying..." : "Continue"}
                    </Button>
                )}
                {step === "qr" && (
                    <Button
                        onClick={onVerify}
                        disabled={verificationCode.length < 6 || isSubmitting}
                    >
                        {isSubmitting ? "Activating..." : "Activate"}
                    </Button>
                )}
                {step === "backup" && <Button onClick={onDone}>Done</Button>}
            </DialogFooter>
        </>
    );
}

function DisableTwoFactorDialog({
    password,
    isSubmitting,
    setPassword,
    onCancel,
    onDisable,
}: {
    password: string;
    isSubmitting: boolean;
    setPassword: (password: string) => void;
    onCancel: () => void;
    onDisable: () => void;
}) {
    return (
        <>
            <DialogHeader>
                <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
                <DialogDescription>
                    Enter your password to disable two-factor authentication.
                </DialogDescription>
            </DialogHeader>
            <DialogPanel>
                <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                    />
                </div>
            </DialogPanel>
            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
                <Button
                    variant="destructive"
                    onClick={onDisable}
                    disabled={!password || isSubmitting}
                >
                    {isSubmitting ? "Disabling..." : "Disable 2FA"}
                </Button>
            </DialogFooter>
        </>
    );
}
