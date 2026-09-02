import { db } from "@uptimekit/db";
import * as schema from "@uptimekit/db/schema/auth";
import { redirect } from "next/navigation";
import SignInForm from "@/components/auth/sign-in-form";

// Disable prerendering - this page needs database access at runtime
export const dynamic = "force-dynamic";

export default async function LoginPage() {
    let showRegister = true;

    const users = await db
        .select({ id: schema.user.id })
        .from(schema.user)
        .limit(1);

    if (users.length === 0) {
        redirect("/register");
    } else {
        showRegister = false;
    }

    const isDemo = process.env.DEMO_MODE === "true";

    return (
        <div className="min-h-screen w-full">
            <SignInForm
                showRegister={showRegister}
                showDiscordLogin={!!process.env.DISCORD_CLIENT_ID}
                showGithubLogin={!!process.env.GITHUB_CLIENT_ID}
                fullPage
                defaultEmail={isDemo ? process.env.DEMO_EMAIL : undefined}
                defaultPassword={isDemo ? process.env.DEMO_PASSWORD : undefined}
                startInPasswordStep={isDemo}
            />
        </div>
    );
}
