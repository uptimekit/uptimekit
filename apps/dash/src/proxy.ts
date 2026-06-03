import { auth } from "@uptimekit/auth";
import { evlogMiddleware } from "evlog/next";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

const withEvlog = evlogMiddleware();

export async function proxy(request: NextRequest) {
	if (request.nextUrl.pathname.startsWith("/api/")) {
		return withEvlog(request);
	}

	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		return NextResponse.redirect(new URL("/login", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/", "/api/:path*"],
};
