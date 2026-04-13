import nodemailer from "nodemailer";

type SubscriberEmailInput = {
	to: string;
	subject: string;
	text: string;
	html?: string;
};

function getEmailProvider() {
	return (process.env.EMAIL_PROVIDER || "").trim().toLowerCase();
}

function getFromAddress() {
	const from = process.env.EMAIL_FROM?.trim();

	if (!from) {
		throw new Error("EMAIL_FROM is not configured");
	}

	return from;
}

async function sendViaResend({ to, subject, text, html }: SubscriberEmailInput) {
	const apiKey = process.env.RESEND_API_KEY?.trim();

	if (!apiKey) {
		throw new Error("RESEND_API_KEY is not configured");
	}

	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: getFromAddress(),
			to: [to],
			subject,
			text,
			...(html ? { html } : {}),
		}),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Resend request failed: ${response.status} ${body}`);
	}
}

async function sendViaSmtp({ to, subject, text, html }: SubscriberEmailInput) {
	const host = process.env.SMTP_HOST?.trim();
	const port = Number(process.env.SMTP_PORT || 587);
	const user = process.env.SMTP_USER?.trim();
	const pass = process.env.SMTP_PASS?.trim();
	const secure =
		(process.env.SMTP_SECURE || "").trim().toLowerCase() === "true" ||
		port === 465;

	if (!host) {
		throw new Error("SMTP_HOST is not configured");
	}

	const transporter = nodemailer.createTransport({
		host,
		port,
		secure,
		auth: user || pass ? { user, pass } : undefined,
	});

	await transporter.sendMail({
		from: getFromAddress(),
		to,
		subject,
		text,
		html,
	});
}

export async function sendSubscriberEmail(input: SubscriberEmailInput) {
	const provider = getEmailProvider();

	if (provider === "resend") {
		await sendViaResend(input);
		return;
	}

	if (provider === "smtp") {
		await sendViaSmtp(input);
		return;
	}

	throw new Error("EMAIL_PROVIDER must be set to 'resend' or 'smtp'");
}
