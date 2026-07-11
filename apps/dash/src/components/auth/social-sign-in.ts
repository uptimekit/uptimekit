import { authClient } from "@/lib/auth-client";

export async function handleSocialSignIn(provider: "discord" | "github") {
    await authClient.signIn.social({ provider, callbackURL: "/" });
}
