import { db } from "@uptimekit/db";
import * as schema from "@uptimekit/db/schema/auth";
import { redirect } from "next/navigation";
import SignUpForm from "@/components/auth/sign-up-form";

// Disable prerendering - this page needs database access at runtime
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
    let showLogin = true;

    const users = await db
        .select({ id: schema.user.id })
        .from(schema.user)
        .limit(1);

    if (users.length > 0) {
        redirect("/login");
    } else {
        showLogin = false;
    }

    return (
        <div className="min-h-screen w-full">
            <SignUpForm
                showLogin={showLogin}
                showDiscordLogin={!!process.env.DISCORD_CLIENT_ID}
                showGithubLogin={!!process.env.GITHUB_CLIENT_ID}
                fullPage
            />
        </div>
    );
}
