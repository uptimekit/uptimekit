import { auth } from "@uptimekit/auth";
import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: request.headers,
    });

    if (!session) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!login|register|two-factor|api|_next/static|_next/image|.*\\..*).*)",
    ],
};
