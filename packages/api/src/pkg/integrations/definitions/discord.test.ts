import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    fetchIntegrationWebhook: vi.fn(
        async (_url: string, _init: RequestInit) => new Response(),
    ),
    findIncident: vi.fn(),
}));

vi.mock("../http", () => ({
    fetchIntegrationWebhook: mocks.fetchIntegrationWebhook,
}));

vi.mock("@uptimekit/db", () => ({
    db: {
        query: {
            incident: {
                findFirst: mocks.findIncident,
            },
        },
    },
}));

import { discordIntegration } from "./discord";

describe("discord integration", () => {
    beforeEach(() => {
        mocks.fetchIntegrationWebhook.mockClear();
        mocks.findIncident.mockClear();
    });

    it.each([1023, 1024, 1025, 10000])(
        "bounds a deleted incident title of %i characters to the embed field limit",
        async (length) => {
            await discordIntegration.handler(
                {
                    webhookUrl:
                        "https://discord.com/api/webhooks/webhook-id/webhook-token",
                },
                "incident.deleted",
                {
                    incidentId: "incident-1",
                    organizationId: "org-1",
                    title: "A".repeat(length),
                    severity: "critical",
                },
            );

            expect(mocks.fetchIntegrationWebhook).toHaveBeenCalledOnce();
            const request = mocks.fetchIntegrationWebhook.mock.calls[0]?.[1];
            const body = JSON.parse(String(request?.body));
            expect(body.embeds[0].fields).toContainEqual({
                name: "`📋` Incident",
                value: "A".repeat(Math.min(length, 1024)),
                inline: true,
            });
            expect(mocks.findIncident).not.toHaveBeenCalled();
        },
    );

    it("formats deleted incidents without querying or linking to the removed incident", async () => {
        await discordIntegration.handler(
            {
                webhookUrl:
                    "https://discord.com/api/webhooks/webhook-id/webhook-token",
            },
            "incident.deleted",
            {
                incidentId: "incident-1",
                organizationId: "org-1",
                title: "API unavailable",
                severity: "critical",
            },
        );

        expect(mocks.findIncident).not.toHaveBeenCalled();

        const request = mocks.fetchIntegrationWebhook.mock.calls[0]?.[1];
        const body = JSON.parse(String(request?.body));
        expect(body.components).toBeUndefined();
        expect(body.embeds[0]).toEqual(
            expect.objectContaining({
                description: "> `🗑️` Incident deleted",
                fields: expect.arrayContaining([
                    expect.objectContaining({
                        name: "`📋` Incident",
                        value: "API unavailable",
                    }),
                    expect.objectContaining({
                        name: "`⚠️` Severity",
                        value: "critical",
                    }),
                    expect.objectContaining({
                        name: "`💬` Details",
                        value: "This incident and its history have been removed.",
                    }),
                ]),
            }),
        );
        expect(String(request?.body)).not.toContain("Manage Incident");
        expect(String(request?.body)).not.toContain("No monitors");
        expect(String(request?.body)).not.toContain("`❓` Reason");
        expect(String(request?.body)).not.toContain('"organizationId"');
    });
});
