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

import { db } from "@uptimekit/db";
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

    it("shows the duration captured when the incident was resolved", async () => {
        // The incident's timeline was edited after resolution; the notification
        // must still describe the resolution that triggered it.
        vi.mocked(db.query.incident.findFirst).mockResolvedValueOnce({
            title: "API unavailable",
            startedAt: new Date("2026-01-01T08:00:00.000Z"),
            resolvedAt: new Date("2026-01-01T09:00:00.000Z"),
            monitors: [{ monitor: { name: "API" } }],
        } as never);

        await smtpIntegration.handler(baseConfig, "incident.resolved", {
            incidentId: "incident-1",
            organizationId: "org-1",
            title: "API unavailable",
            severity: "critical",
            startedAt: "2026-01-01T10:00:00.000Z",
            resolvedAt: "2026-01-01T12:15:00.000Z",
        });

        expect(mocks.sendMail).toHaveBeenCalledWith(
            expect.objectContaining({
                text: expect.stringContaining("Duration: 2h 15m"),
                html: expect.stringContaining(
                    "<p><strong>Duration:</strong> 2h 15m</p>",
                ),
            }),
        );
    });

    it("omits the duration when the resolved event has no timeline", async () => {
        await smtpIntegration.handler(baseConfig, "incident.resolved", {
            incidentId: "incident-1",
            organizationId: "org-1",
            title: "API unavailable",
            severity: "critical",
        });

        const [mail] = mocks.sendMail.mock.calls[0] as unknown as [
            { text: string; html: string },
        ];
        expect(mail.text).not.toContain("Duration");
        expect(mail.html).not.toContain("Duration");
    });
});
