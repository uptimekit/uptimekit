import { db } from "@uptimekit/db";
import * as schema from "@uptimekit/db/schema/auth";
import { redirect } from "next/navigation";
import SignInForm from "@/components/auth/sign-in-form";

export default async function LoginPage() {
	const isSelfHosted = process.env.NEXT_PUBLIC_SELFHOSTED === "true";

	let showRegister = true;

	if (isSelfHosted) {
		const users = await db
			.select({ id: schema.user.id })
			.from(schema.user)
			.limit(1);

		if (users.length === 0) {
			redirect("/register");
		} else {
			showRegister = false;
		}
	}

	return (
		<div className="flex min-h-screen w-full items-center justify-center p-4">
			<SignInForm
				showRegister={showRegister}
				showDiscordLogin={!!process.env.DISCORD_CLIENT_ID}
				showGithubLogin={!!process.env.GITHUB_CLIENT_ID}
			/>
		</div>
	);
}
