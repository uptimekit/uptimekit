import { redirect } from "next/navigation";
import { db } from "@uptimekit/db";
import * as schema from "@uptimekit/db/schema/auth";
import SignInForm from "@/components/auth/sign-in-form";

export default async function LoginPage() {
	const isSelfHosted = process.env.NEXT_PUBLIC_SELFHOSTED === "true";

	if (isSelfHosted) {
		// Check if any users exist in self-hosted mode (server-side)
		const users = await db.select({ id: schema.user.id }).from(schema.user).limit(1);
		
		if (users.length === 0) {
			// No users exist, redirect to register
			redirect("/register");
		}
	}

	return (
		<div className="flex min-h-screen w-full items-center justify-center p-4">
			<SignInForm />
		</div>
	);
}
