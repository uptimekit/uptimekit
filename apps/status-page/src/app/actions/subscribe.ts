"use server";

import { db, statusPageEmailSubscribers } from "@uptimekit/db";
import { statusPage } from "@uptimekit/db/schema/status-pages";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { getCookieName, verifyAccessToken } from "@/lib/access-token";
import { checkRateLimit } from "@/lib/rate-limit";

export type SubscribeActionState = {
	error: string;
	success: string;
};

const emptyToUndefined = (value: unknown) =>
	typeof value === "string" && value.trim().length > 0
		? value.trim()
		: undefined;

const subscribeSchema = z.object({
	statusPageId: z.string().min(1),
	email: z.email(),
	slackWebhookUrl: z
		.url("Please enter a valid Slack webhook URL.")
		.refine(
			(url) => url.startsWith("https://hooks.slack.com/services/"),
			"Slack webhook must start with https://hooks.slack.com/services/.",
		)
		.optional(),
	discordWebhookUrl: z
		.url("Please enter a valid Discord webhook URL.")
		.refine(
			(url) =>
				url.startsWith("https://discord.com/api/webhooks/") ||
				url.startsWith("https://canary.discord.com/api/webhooks/") ||
				url.startsWith("https://ptb.discord.com/api/webhooks/"),
			"Discord webhook must be a valid Discord webhook URL.",
		)
		.optional(),
});

export async function subscribeToStatusPage(
	_prevState: SubscribeActionState,
	formData: FormData,
): Promise<SubscribeActionState> {
	try {
		const payload = subscribeSchema.safeParse({
			statusPageId: formData.get("statusPageId"),
			email: formData.get("email"),
			slackWebhookUrl: emptyToUndefined(formData.get("slackWebhookUrl")),
			discordWebhookUrl: emptyToUndefined(formData.get("discordWebhookUrl")),
		});

		if (!payload.success) {
			return {
				error:
					payload.error.issues[0]?.message || "Please check your subscription details.",
				success: "",
			};
		}

		const { statusPageId, email, slackWebhookUrl, discordWebhookUrl } =
			payload.data;
		const normalizedEmail = email.trim().toLowerCase();

		const requestHeaders = await headers();
		const ip =
			requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
			requestHeaders.get("x-real-ip") ||
			"unknown";

		const { allowed } = await checkRateLimit(`${ip}:${statusPageId}`, {
			namespace: "status-page-subscribe",
			maxAttempts: 10,
		});

		if (!allowed) {
			return {
				error: "Too many subscription attempts. Please try again later.",
				success: "",
			};
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
			return {
				error: "Status page not found.",
				success: "",
			};
		}

		const design = (page.design as Record<string, unknown> | null) || {};
		if (!design.allowSubscriptions) {
			return {
				error: "Subscriptions are disabled for this status page.",
				success: "",
			};
		}

		if (!page.public && page.password) {
			const cookieStore = await cookies();
			const token = cookieStore.get(getCookieName(page.id))?.value;

			if (!token || !verifyAccessToken(token, page.id)) {
				return {
					error: "You must unlock this status page before subscribing.",
					success: "",
				};
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

		return {
			error: "",
			success: "You're subscribed to status updates.",
		};
	} catch (error) {
		console.error("Status page subscribe action error:", error);
		return {
			error: "Internal server error.",
			success: "",
		};
	}
}