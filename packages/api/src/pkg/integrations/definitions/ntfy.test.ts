import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    assertSafePublicHttpUrl: vi.fn(async () => undefined),
    fetchIntegrationWebhook: vi.fn(
        async (_url: string, _init: RequestInit) => new Response(),
    ),
}));

vi.mock("../../../lib/safe-url", () => ({
    assertSafePublicHttpUrl: mocks.assertSafePublicHttpUrl,
}));

vi.mock("../http", () => ({
    fetchIntegrationWebhook: mocks.fetchIntegrationWebhook,
}));

vi.mock("@uptimekit/db", () => ({
    db: {
        query: {
            incident: {
                findFirst: vi.fn(async () => ({
                    title: "API unavailable",
                    monitors: [{ monitor: { name: "API" } }],
                })),
            },
        },
    },
}));

import { ntfyIntegration } from "./ntfy";
import { type NtfyConfig, NtfyConfigSchema } from "./ntfy-meta";

const baseConfig: NtfyConfig = {
    serverUrl: "https://ntfy.example.com/",
    topic: "uptimekit-alerts",
    accessToken: "tk_secret",
    priority: "high",
    tags: "warning, uptimekit",
};

describe("ntfy integration", () => {
    beforeEach(() => {
        mocks.assertSafePublicHttpUrl.mockClear();
        mocks.fetchIntegrationWebhook.mockClear();
    });

    it("validates topics and applies defaults", () => {
        const parsed = NtfyConfigSchema.parse({ topic: "uptimekit_alerts" });

        expect(parsed.serverUrl).toBe("https://ntfy.sh");
        expect(parsed.priority).toBe("default");
        expect(
            NtfyConfigSchema.safeParse({ topic: "invalid topic" }).success,
        ).toBe(false);
    });

    it("publishes authenticated integration tests as JSON", async () => {
        await ntfyIntegration.handler(baseConfig, "integration.test", {
            description: "ntfy works",
        });

        expect(mocks.assertSafePublicHttpUrl).toHaveBeenCalledWith(
            "https://ntfy.example.com",
            { label: "ntfy server URL" },
        );
        expect(mocks.fetchIntegrationWebhook).toHaveBeenCalledWith(
            "https://ntfy.example.com",
            expect.objectContaining({
                method: "POST",
                redirect: "error",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer tk_secret",
                },
            }),
        );

        const request = mocks.fetchIntegrationWebhook.mock.calls[0]?.[1];
        const body = JSON.parse(String(request?.body));
        expect(body).toEqual(
            expect.objectContaining({
                topic: "uptimekit-alerts",
                title: "UptimeKit integration test",
                message: expect.stringContaining("ntfy works"),
                priority: 4,
                tags: ["warning", "uptimekit"],
            }),
        );
    });

    it("includes incident context and a dashboard click target", async () => {
        await ntfyIntegration.handler(baseConfig, "incident.created", {
            incidentId: "incident-1",
            organizationId: "org-1",
            title: "API unavailable",
            description: "Health check failed",
            severity: "critical",
        });

        const request = mocks.fetchIntegrationWebhook.mock.calls[0]?.[1];
        const body = JSON.parse(String(request?.body));
        expect(body.title).toBe("New incident created: API unavailable");
        expect(body.message).toContain("Monitors: API");
        expect(body.message).toContain("Health check failed");
        expect(body.click).toBe("http://localhost:3000/incidents/incident-1");
    });
});
