import { type NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@uptimekit/auth";

export async function proxy(request: NextRequest) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		return NextResponse.redirect(new URL("/sign-in", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/dashboard"], // Apply middleware to specific routes
};
