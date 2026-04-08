"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { sileo } from "sileo";
import SignInForm from "@/components/auth/sign-in-form";
import SignUpForm from "@/components/auth/sign-up-form";
import Loader from "@/components/common/loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";

interface InviteClientProps {
	token: string;
	invitation: {
		organizationName: string;
		email: string;
		id: string;
	};
}

export default function InviteClient({ token, invitation }: InviteClientProps) {
	const { data: session, isPending: isSessionPending } =
		authClient.useSession();
	const router = useRouter();

	const [activeTab, setActiveTab] = useState("register");

	const acceptInvite = useCallback(async () => {
		await authClient.organization.acceptInvitation(
			{
				invitationId: token,
			},
			{
				onSuccess: () => {
					// better-auth might return organizationId in response
					sileo.success({ title: "Joined organization successfully" });
					router.push("/");
				},
				onError: (ctx) => {
					sileo.error({ title: ctx.error.message });
				},
			},
		);
	}, [token, router]);

	useEffect(() => {
		if (session) {
			acceptInvite();
		}
	}, [session, acceptInvite]);

	if (isSessionPending || session) {
		return <Loader />;
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-muted/50 p-4">
			<div className="w-full max-w-md space-y-6">
				<div className="text-center">
					<h1 className="font-bold text-2xl">
						Join {invitation.organizationName}
					</h1>
					<p className="text-muted-foreground text-sm">
						You have been invited to join this organization.
					</p>
				</div>

				<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="register">Register</TabsTrigger>
						<TabsTrigger value="login">Login</TabsTrigger>
					</TabsList>
					<div className="mt-6">
						<TabsContent value="login" className="m-0">
							<SignInForm
								showRegister={false}
								showDiscordLogin={false}
								showGithubLogin={false}
								onSuccess={acceptInvite}
								email={invitation.email}
								emailReadOnly
							/>
						</TabsContent>
						<TabsContent value="register" className="m-0">
							<SignUpForm
								showLogin={false}
								showDiscordLogin={false}
								showGithubLogin={false}
								onSuccess={acceptInvite}
								email={invitation.email}
								emailReadOnly
							/>
						</TabsContent>
					</div>
				</Tabs>
			</div>
		</div>
	);
}
