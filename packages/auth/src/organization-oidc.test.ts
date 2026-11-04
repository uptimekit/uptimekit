import { describe, expect, it, vi } from "vitest";

vi.mock("@uptimekit/db", () => ({ db: {} }));

import { toGenericOAuthConfig } from "./organization-oidc";

const { mapProfileToUser } = toGenericOAuthConfig({
    id: "provider",
    clientId: "client",
    clientSecret: "secret",
    discoveryUrl: "https://idp.example.com/.well-known/openid-configuration",
    scopes: ["openid"],
} as Parameters<typeof toGenericOAuthConfig>[0]);

describe("organization OIDC profile mapping", () => {
    it.each([
        [{ email_verified: true }, true],
        [{ email_verified: "true" }, true],
        [{ emailVerified: true }, true],
        [{ email_verified: false }, false],
        [{ email_verified: "false" }, false],
        [{ email_verified: "false", emailVerified: true }, false],
        [{}, false],
    ])("maps %j to emailVerified %s", async (claims, emailVerified) => {
        const user = await mapProfileToUser?.({
            email: "user@example.com",
            ...claims,
        } as Parameters<NonNullable<typeof mapProfileToUser>>[0]);

        expect(user?.emailVerified).toBe(emailVerified);
    });
});
