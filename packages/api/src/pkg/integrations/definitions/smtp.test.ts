import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const sendMail = vi.fn(async () => undefined);

	return {
		createTransport: vi.fn(() => ({ sendMail })),
		sendMail,
	};
});

vi.mock("nodemailer", () => ({
	default: {
		createTransport: mocks.createTransport,
	},
}));

vi.mock("@uptimekit/db", () => ({
	db: {
		query: {
			incident: {
				findFirst: vi.fn(async () => ({
					title: "API unavailable",
					monitors: [
						{
							monitor: {
								name: "API",
							},
						},
					],
				})),
			},
		},
	},
}));

import { smtpIntegration } from "./smtp";
import { type SmtpConfig, SmtpConfigSchema } from "./smtp-meta";

const baseConfig: SmtpConfig = {
	host: "smtp.example.com",
	port: 587,
	secure: "auto",
	username: "alerts",
	password: "secret",
	from: "alerts@example.com",
	to: "ops@example.com, dev@example.com",
};

describe("smtp integration", () => {
	beforeEach(() => {
		mocks.createTransport.mockClear();
		mocks.sendMail.mockClear();
	});

	it("validates and defaults SMTP configuration", () => {
		const parsed = SmtpConfigSchema.parse({
			host: "smtp.example.com",
			from: "alerts@example.com",
			to: "ops@example.com;dev@example.com",
		});

		expect(parsed.port).toBe(587);
		expect(parsed.secure).toBe("auto");
		expect(
			SmtpConfigSchema.safeParse({
				host: "smtp.example.com",
				from: "alerts@example.com",
				to: ",,,",
			}).success,
		).toBe(false);
	});

	it("sends integration test emails through nodemailer", async () => {
		await smtpIntegration.handler(baseConfig, "integration.test", {
			description: "SMTP works <now>",
		});

		expect(mocks.createTransport).toHaveBeenCalledWith({
			host: "smtp.example.com",
			port: 587,
			secure: false,
			auth: {
				user: "alerts",
				pass: "secret",
			},
		});
		expect(mocks.sendMail).toHaveBeenCalledWith(
			expect.objectContaining({
				from: "alerts@example.com",
				to: ["ops@example.com", "dev@example.com"],
				subject: "[UptimeKit] SMTP integration test",
				text: expect.stringContaining("SMTP works <now>"),
				html: expect.stringContaining("SMTP works &lt;now&gt;"),
			}),
		);
	});

	it("builds incident notifications with monitor context", async () => {
		await smtpIntegration.handler(baseConfig, "incident.created", {
			incidentId: "incident-1",
			organizationId: "org-1",
			title: "API unavailable",
			description: "Health check failed",
			severity: "critical",
		});

		expect(mocks.sendMail).toHaveBeenCalledWith(
			expect.objectContaining({
				subject: "[UptimeKit] New incident created: API unavailable",
				text: expect.stringContaining("Monitors: API"),
				html: expect.stringContaining("Health check failed"),
			}),
		);
	});
});
