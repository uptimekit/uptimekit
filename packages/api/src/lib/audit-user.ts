import type { Context } from "../context";

export function getAuditUserId(context: Pick<Context, "authType" | "session">) {
    // Organization API keys have no user row, even when sent with a browser cookie.
    return context.authType === "session"
        ? (context.session?.user.id ?? null)
        : null;
}
