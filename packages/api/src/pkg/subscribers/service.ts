import { db, statusPageEmailSubscribers } from "@uptimekit/db";
import { incidentStatusPage } from "@uptimekit/db/schema/incidents";
import { statusPage } from "@uptimekit/db/schema/status-pages";
import { and, eq, inArray } from "drizzle-orm";
import { assertSafeWebhookUrl } from "../../lib/safe-url";
import { createLogger } from "../../lib/logger";
import { eventBus } from "../../lib/events";
import { sendSubscriberEmail } from "./email";
import {
	renderSubscriberEmailHtml,
	renderSubscriberEmailText,
} from "./templates";

const logger = createLogger("SUBSCRIBERS");

type SubscriberEventName = "incident.acknowledged" | "incident.resolved";

type SubscriberEventPayload = {
	incidentId: string;
	organizationId: string;
	title: string;
	description?: string | null;
	severity: "minor" | "major" | "critical";
};

type SubscriberStatusPage = {
	id: string;
	name: string;
	slug: string;
	domain: string | null;
	design: unknown;
};

const eventLabels: Record<SubscriberEventName, string> = {
	"incident.acknowledged": "Incident acknowledged",
	"incident.resolved": "Incident resolved",
};

function getDashboardBaseUrl() {
	return (process.env.NEXT_PUBLIC_URL || "http://localhost:3000").replace(
		/\/$/,
		"",
	);
}

function getStatusPageBaseUrl(page: SubscriberStatusPage) {
	if (page.domain) {
		const normalizedDomain = page.domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
		return `https://${normalizedDomain}`;
	}

	const baseDomain =
		process.env.NEXT_PUBLIC_STATUS_PAGE_DOMAIN || "status.uptimekit.dev";
	return `https://${baseDomain.replace(/\/$/, "")}/${page.slug}`;
}

function getIncidentLink(page: SubscriberStatusPage, incidentId: string) {
	if (page.slug || page.domain) {
		return `${getStatusPageBaseUrl(page)}/incidents/${incidentId}`;
	}

	return `${getDashboardBaseUrl()}/incidents/${incidentId}`;
}

function buildMessageContent(
	event: SubscriberEventName,
	payload: SubscriberEventPayload,
	page: SubscriberStatusPage,
) {
	const eventLabel = eventLabels[event];
	const incidentUrl = getIncidentLink(page, payload.incidentId);
	const severity = payload.severity.toUpperCase();
	const description =
		payload.description?.trim() ||
		(event === "incident.resolved"
			? "The incident has been resolved."
			: "The incident has been acknowledged.");

	const subject = `[${page.name}] ${eventLabel}: ${payload.title}`;

	const text = renderSubscriberEmailText({
		eventLabel,
		statusPageName: page.name,
		incidentTitle: payload.title,
		severity,
		description,
		incidentUrl,
	});

	const html = renderSubscriberEmailHtml({
		eventLabel,
		statusPageName: page.name,
		incidentTitle: payload.title,
		severity,
		description,
		incidentUrl,
	});

	const slackText = `${eventLabel}\nStatus page: ${page.name}\nIncident: ${payload.title}\nSeverity: ${severity}\n${description}\n${incidentUrl}`;

	const discordBody = {
		embeds: [
			{
				title: eventLabel,
				description,
				color: event === "incident.resolved" ? 65280 : 16776960,
				fields: [
					{ name: "Status page", value: page.name, inline: true },
					{ name: "Incident", value: payload.title, inline: true },
					{ name: "Severity", value: severity, inline: true },
				],
				url: incidentUrl,
				timestamp: new Date().toISOString(),
			},
		],
	};

	return {
		subject,
		text,
		html,
		slackText,
		discordBody,
	};
}

async function postWebhook(url: string, body: unknown, destination: string) {
	await assertSafeWebhookUrl(url);

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 10000);

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`${destination} webhook failed: ${response.status} ${text}`);
		}
	} catch (error) {
		clearTimeout(timeoutId);
		if (error instanceof Error && error.name === "AbortError") {
			throw new Error(`${destination} webhook timed out after 10 seconds`);
		}
		throw error;
	}
}

export class SubscriberNotificationService {
	constructor() {
		this.setupListeners();
	}

	private setupListeners() {
		const events = ["incident.acknowledged", "incident.resolved"] as const;

		for (const eventName of events) {
			eventBus.on(eventName, async (payload) => {
				await this.handleEvent(eventName, payload);
			});
		}
	}

	private async handleEvent(
		event: SubscriberEventName,
		payload: SubscriberEventPayload,
	) {
		try {
			const statusPageLinks = await db
				.select({
					statusPageId: incidentStatusPage.statusPageId,
				})
				.from(incidentStatusPage)
				.where(eq(incidentStatusPage.incidentId, payload.incidentId));

			if (statusPageLinks.length === 0) {
				return;
			}

			const statusPageIds = statusPageLinks.map((row) => row.statusPageId);
			const [pages, subscribers] = await Promise.all([
				db
					.select({
						id: statusPage.id,
						name: statusPage.name,
						slug: statusPage.slug,
						domain: statusPage.domain,
						design: statusPage.design,
					})
					.from(statusPage)
					.where(
						and(
							eq(statusPage.organizationId, payload.organizationId),
							inArray(statusPage.id, statusPageIds),
						),
					),
				db
					.select()
					.from(statusPageEmailSubscribers)
					.where(inArray(statusPageEmailSubscribers.statusPageId, statusPageIds)),
			]);

			const pagesById = new Map(pages.map((page) => [page.id, page]));

			for (const subscriber of subscribers) {
				const page = pagesById.get(subscriber.statusPageId);

				if (!page) {
					continue;
				}

				const design = (page.design as Record<string, unknown> | null) || {};
				if (!design.allowSubscriptions) {
					continue;
				}

				const message = buildMessageContent(event, payload, page);

				try {
					await sendSubscriberEmail({
						to: subscriber.email,
						subject: message.subject,
						text: message.text,
						html: message.html,
					});
				} catch (error) {
					logger.error(
						`Failed to send email notification for incident ${payload.incidentId} to ${subscriber.email}`,
						error,
					);
				}

				if (subscriber.slackWebhookUrl) {
					try {
						await postWebhook(
							subscriber.slackWebhookUrl,
							{ text: message.slackText },
							"Slack",
						);
					} catch (error) {
						logger.error(
							`Failed to send Slack notification for incident ${payload.incidentId} on status page ${page.id}`,
							error,
						);
					}
				}

				if (subscriber.discordWebhookUrl) {
					try {
						await postWebhook(
							subscriber.discordWebhookUrl,
							message.discordBody,
							"Discord",
						);
					} catch (error) {
						logger.error(
							`Failed to send Discord notification for incident ${payload.incidentId} on status page ${page.id}`,
							error,
						);
					}
				}
			}
		} catch (error) {
			logger.error(
				`Failed to handle subscriber event ${event} for incident ${payload.incidentId}`,
				error,
			);
			return;
		}
	}
}

export const subscriberNotificationService = new SubscriberNotificationService();