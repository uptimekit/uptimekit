import { db } from "@uptimekit/db";
import * as schema from "@uptimekit/db/schema/auth";
import { redirect } from "next/navigation";
import SignUpForm from "@/components/auth/sign-up-form";

export default async function RegisterPage() {
	const isSelfHosted = process.env.NEXT_PUBLIC_SELFHOSTED === "true";
	let showLogin = true;

	if (isSelfHosted) {
		const users = await db
			.select({ id: schema.user.id })
			.from(schema.user)
			.limit(1);

		if (users.length > 0) {
			redirect("/login");
		} else {
			showLogin = false;
		}
	}

	return (
		<div className="flex min-h-screen w-full items-center justify-center p-4">
			<SignUpForm showLogin={showLogin} />
		</div>
	);
}
