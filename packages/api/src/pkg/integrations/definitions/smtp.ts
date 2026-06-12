import { db } from "@uptimekit/db";
import nodemailer from "nodemailer";
import { createLogger } from "../../../lib/logger";
import type { IntegrationDefinition } from "../registry";
import { type SmtpConfig, smtpIntegrationMeta } from "./smtp-meta";

interface MailContent {
	subject: string;
	text: string;
	html: string;
}

interface IncidentPayload {
	incidentId: string;
	title?: string;
	description?: string | null;
	message?: string;
	severity?: string;
}

interface SslPayload {
	monitorId: string;
	monitorName: string;
	domain: string;
	issuer?: string;
	validTo?: string;
	daysUntilExpiry: number;
	isValid: boolean;
	error?: string;
	threshold: number;
}

const logger = createLogger("SMTP");

function getBaseUrl() {
	return process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
}

function escapeHtml(value: unknown) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function getSecure(config: SmtpConfig) {
	if (config.secure === "true") {
		return true;
	}

	if (config.secure === "false") {
		return false;
	}

	return config.port === 465;
}

function getAuth(config: SmtpConfig) {
	const username = config.username?.trim();

	if (!username && !config.password) {
		return undefined;
	}

	if (!username || !config.password) {
		throw new Error("SMTP username and password must be provided together");
	}

	return {
		user: username,
		pass: config.password,
	};
}

function getRecipients(config: SmtpConfig) {
	return config.to
		.split(/[;,]/)
		.map((recipient) => recipient.trim())
		.filter(Boolean);
}

function getPayloadText(payload: Record<string, unknown>, key: string) {
	const value = payload[key];
	return typeof value === "string" ? value : undefined;
}

function buildTestMail(payload: unknown): MailContent {
	const payloadRecord = (payload || {}) as Record<string, unknown>;
	const description =
		getPayloadText(payloadRecord, "description") || "No details provided";
	const timestamp = new Date().toLocaleString();

	const text = [
		"SMTP integration test",
		"",
		"Status: Your SMTP notification integration is working correctly.",
		"",
		"Message:",
		description,
		"",
		`Timestamp: ${timestamp}`,
	].join("\n");

	const html = [
		"<h2>SMTP integration test</h2>",
		"<p><strong>Status:</strong> Your SMTP notification integration is working correctly.</p>",
		"<p><strong>Message:</strong></p>",
		`<pre>${escapeHtml(description)}</pre>`,
		`<p><strong>Timestamp:</strong> ${escapeHtml(timestamp)}</p>`,
	].join("");

	return {
		subject: "[UptimeKit] SMTP integration test",
		text,
		html,
	};
}

function buildSslMail(payload: SslPayload): MailContent {
	const baseUrl = getBaseUrl();
	const monitorUrl = `${baseUrl}/monitors/${payload.monitorId}`;
	const title = payload.isValid
		? "SSL certificate expiring"
		: "SSL certificate problem";
	const details =
		payload.error ||
		`Certificate expires in ${payload.daysUntilExpiry} day${payload.daysUntilExpiry === 1 ? "" : "s"}.`;

	const rows = [
		["Monitor", payload.monitorName],
		["Domain", payload.domain],
		["Issuer", payload.issuer || "Unknown"],
		["Valid until", payload.validTo || "Unknown"],
		["Threshold", `${payload.threshold} days`],
	];

	const text = [
		title,
		"",
		...rows.map(([label, value]) => `${label}: ${value}`),
		"",
		"Details:",
		details,
		"",
		`View Monitor: ${monitorUrl}`,
	].join("\n");

	const htmlRows = rows
		.map(
			([label, value]) =>
				`<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`,
		)
		.join("");

	return {
		subject: `[UptimeKit] ${title}: ${payload.domain}`,
		text,
		html: [
			`<h2>${escapeHtml(title)}</h2>`,
			htmlRows,
			"<p><strong>Details:</strong></p>",
			`<pre>${escapeHtml(details)}</pre>`,
			`<p><a href="${escapeHtml(monitorUrl)}">View Monitor</a></p>`,
		].join(""),
	};
}

function getIncidentCopy(event: string, payload: IncidentPayload) {
	switch (event) {
		case "incident.created":
			return {
				title: "New incident created",
				detailLabel: "Details",
				detail: payload.description || "No details provided",
			};
		case "incident.resolved":
			return {
				title: "Incident resolved",
				detailLabel: "Details",
				detail: payload.description || "The incident has been resolved.",
			};
		case "incident.acknowledged":
			return {
				title: "Incident acknowledged",
				detailLabel: "Details",
				detail: payload.description || "The incident has been acknowledged.",
			};
		case "incident.comment_added":
			return {
				title: "New incident comment",
				detailLabel: "Comment",
				detail: payload.message || "No content",
			};
		default:
			return {
				title: `Event: ${event}`,
				detailLabel: "Payload",
				detail: JSON.stringify(payload, null, 2),
			};
	}
}

async function buildIncidentMail(
	event: string,
	payload: IncidentPayload,
): Promise<MailContent | null> {
	const incidentData = await db.query.incident.findFirst({
		where: (t, { eq }) => eq(t.id, payload.incidentId),
		with: {
			monitors: {
				with: {
					monitor: true,
				},
			},
		},
	});

	if (!incidentData) {
		return null;
	}

	const baseUrl = getBaseUrl();
	const incidentUrl = `${baseUrl}/incidents/${payload.incidentId}`;
	const incidentTitle = payload.title || incidentData.title || "Incident";
	const monitorNames =
		incidentData.monitors.map((item) => item.monitor.name).join(", ") ||
		"No monitors";
	const copy = getIncidentCopy(event, payload);

	const rows = [
		["Incident", incidentTitle],
		["Severity", payload.severity || "Unknown"],
		["Monitors", monitorNames],
	];

	const text = [
		copy.title,
		"",
		...rows.map(([label, value]) => `${label}: ${value}`),
		"",
		`${copy.detailLabel}:`,
		copy.detail,
		"",
		`Manage Incident: ${incidentUrl}`,
	].join("\n");

	const htmlRows = rows
		.map(
			([label, value]) =>
				`<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`,
		)
		.join("");

	return {
		subject: `[UptimeKit] ${copy.title}: ${incidentTitle}`,
		text,
		html: [
			`<h2>${escapeHtml(copy.title)}</h2>`,
			htmlRows,
			`<p><strong>${escapeHtml(copy.detailLabel)}:</strong></p>`,
			`<pre>${escapeHtml(copy.detail)}</pre>`,
			`<p><a href="${escapeHtml(incidentUrl)}">Manage Incident</a></p>`,
		].join(""),
	};
}

async function sendMail(config: SmtpConfig, content: MailContent) {
	const transporter = nodemailer.createTransport({
		host: config.host,
		port: config.port,
		secure: getSecure(config),
		auth: getAuth(config),
	});

	await transporter.sendMail({
		from: config.from,
		to: getRecipients(config),
		subject: content.subject,
		text: content.text,
		html: content.html,
	});
}

export const smtpIntegration: IntegrationDefinition<SmtpConfig> = {
	...smtpIntegrationMeta,
	handler: async (config, event, payload) => {
		try {
			if (event === "integration.test") {
				await sendMail(config, buildTestMail(payload));
				return;
			}

			const content =
				event === "monitor.ssl.expiring"
					? buildSslMail(payload as SslPayload)
					: await buildIncidentMail(event, payload as IncidentPayload);

			if (!content) {
				return;
			}

			await sendMail(config, content);
		} catch (error) {
			logger.error(`Failed to send SMTP notification to ${config.to}`, error);
			throw error;
		}
	},
};
