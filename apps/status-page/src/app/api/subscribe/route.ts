import { db, statusPageEmailSubscribers } from "@uptimekit/db";
import { statusPage } from "@uptimekit/db/schema/status-pages";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getCookieName, verifyAccessToken } from "@/lib/access-token";
import { checkRateLimit } from "@/lib/rate-limit";
import { type NextRequest, NextResponse } from "next/server";

const subscribeSchema = z.object({
	statusPageId: z.string().min(1),
	email: z.email(),
	slackWebhookUrl: z
		.url()
		.refine((url) => url.startsWith("https://hooks.slack.com/services/"))
		.optional(),
	discordWebhookUrl: z
		.url()
		.refine(
			(url) =>
				url.startsWith("https://discord.com/api/webhooks/") ||
				url.startsWith("https://canary.discord.com/api/webhooks/") ||
				url.startsWith("https://ptb.discord.com/api/webhooks/"),
		)
		.optional(),
});

const emptyToUndefined = (value: unknown) =>
	typeof value === "string" && value.trim().length > 0
		? value.trim()
		: undefined;

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const payload = subscribeSchema.safeParse({
			statusPageId: body.statusPageId,
			email: body.email,
			slackWebhookUrl: emptyToUndefined(body.slackWebhookUrl),
			discordWebhookUrl: emptyToUndefined(body.discordWebhookUrl),
		});

		if (!payload.success) {
			return NextResponse.json(
				{ error: "Invalid subscription request" },
				{ status: 400 },
			);
		}

		const { statusPageId, email, slackWebhookUrl, discordWebhookUrl } =
			payload.data;
		const normalizedEmail = email.trim().toLowerCase();

		const ip =
			request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
			request.headers.get("x-real-ip") ||
			"unknown";
		const { allowed, remaining, resetAt } = await checkRateLimit(
			`${ip}:${statusPageId}`,
			{
				namespace: "status-page-subscribe",
				maxAttempts: 10,
			},
		);

		if (!allowed) {
			return NextResponse.json(
				{
					error: "Too many subscription attempts. Please try again later.",
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

		const page = await db.query.statusPage.findFirst({
			where: eq(statusPage.id, statusPageId),
			columns: {
				id: true,
				public: true,
				password: true,
				design: true,
			},
		});

		if (!page) {
			return NextResponse.json(
				{ error: "Status page not found" },
				{ status: 404 },
			);
		}

		const design = (page.design as Record<string, unknown> | null) || {};
		if (!design.allowSubscriptions) {
			return NextResponse.json(
				{ error: "Subscriptions are disabled for this status page." },
				{ status: 403 },
			);
		}

		if (!page.public && page.password) {
			const token = request.cookies.get(getCookieName(page.id))?.value;
			if (!token || !verifyAccessToken(token, page.id)) {
				return NextResponse.json(
					{ error: "Unauthorized" },
					{ status: 401 },
				);
			}
		}

		await db
			.insert(statusPageEmailSubscribers)
			.values({
				statusPageId,
				email: normalizedEmail,
				slackWebhookUrl: slackWebhookUrl || null,
				discordWebhookUrl: discordWebhookUrl || null,
			})
			.onConflictDoNothing();

		const [subscription] = await db
			.select()
			.from(statusPageEmailSubscribers)
			.where(
				and(
					eq(statusPageEmailSubscribers.statusPageId, statusPageId),
					eq(statusPageEmailSubscribers.email, normalizedEmail),
				),
			)
			.limit(1);

		return NextResponse.json({
			success: true,
			subscriber: subscription ?? null,
		});
	} catch (error) {
		console.error("Status page subscribe error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
