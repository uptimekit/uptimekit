import { verify } from "@node-rs/argon2";
import { db, statusPage } from "@uptimekit/db";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { generateAccessToken, getCookieName } from "@/lib/access-token";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { statusPageId, password } = body;

		if (!statusPageId || !password) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 },
			);
		}

		// Rate limiting by IP
		const ip =
			request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
			request.headers.get("x-real-ip") ||
			"unknown";
		const rateLimitKey = `${ip}:${statusPageId}`;
		const { allowed, remaining, resetAt } = await checkRateLimit(rateLimitKey);

		if (!allowed) {
			return NextResponse.json(
				{
					error: "Too many attempts. Please try again later.",
					resetAt,
				},
				{
					status: 429,
					headers: {
						"Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
						"X-RateLimit-Remaining": String(remaining),
					},
				},
			);
		}

		// Fetch status page
		const page = await db.query.statusPage.findFirst({
			where: eq(statusPage.id, statusPageId),
			columns: {
				id: true,
				password: true,
				public: true,
			},
		});

		if (!page) {
			return NextResponse.json(
				{ error: "Status page not found" },
				{ status: 404 },
			);
		}

		if (page.public || !page.password) {
			return NextResponse.json(
				{ error: "This page does not require a password" },
				{ status: 400 },
			);
		}

		// Verify password
		const isValid = await verify(page.password, password);

		if (!isValid) {
			return NextResponse.json(
				{ error: "Invalid password" },
				{
					status: 401,
					headers: {
						"X-RateLimit-Remaining": String(remaining - 1),
					},
				},
			);
		}

		// Generate access token and set cookie
		const token = generateAccessToken(statusPageId);
		const cookieName = getCookieName(statusPageId);

		const cookieStore = await cookies();
		cookieStore.set(cookieName, token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			maxAge: 24 * 60 * 60, // 24 hours
			path: "/",
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Password verification error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
