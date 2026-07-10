import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
    getApiKeyFromHeaders: vi.fn(),
    getSession: vi.fn(),
    verifyApiKey: vi.fn(),
}));

vi.mock("@uptimekit/auth", () => ({
    API_KEY_ORGANIZATION_HEADER: "x-organization-id",
    auth: {
        api: {
            getSession: authMocks.getSession,
            verifyApiKey: authMocks.verifyApiKey,
        },
    },
    getApiKeyFromHeaders: authMocks.getApiKeyFromHeaders,
}));

import { createContext } from "./context";

function createSession(activeOrganizationId = "org-old") {
    const now = new Date("2026-07-10T00:00:00Z");

    return {
        session: {
            id: "session-1",
            token: "session-token",
            userId: "user-1",
            expiresAt: now,
            createdAt: now,
            updatedAt: now,
            activeOrganizationId,
        },
        user: {
            id: "user-1",
            name: "Test User",
            email: "test@example.com",
            emailVerified: true,
            createdAt: now,
            updatedAt: now,
        },
    };
}

describe("createContext", () => {
    beforeEach(() => {
        authMocks.getApiKeyFromHeaders.mockReset().mockReturnValue(null);
        authMocks.getSession.mockReset().mockResolvedValue(null);
        authMocks.verifyApiKey.mockReset();
    });

    it("creates an anonymous context without credentials", async () => {
        const headers = new Headers();

        const context = await createContext({ headers });

        expect(context).toEqual({
            apiKey: null,
            authType: "anonymous",
            headers,
            session: null,
        });
        expect(authMocks.verifyApiKey).not.toHaveBeenCalled();
    });

    it("uses an authenticated browser session when no API key is present", async () => {
        const session = createSession();
        authMocks.getSession.mockResolvedValue(session);

        const context = await createContext({ headers: new Headers() });

        expect(context.authType).toBe("session");
        expect(context.session).toBe(session);
        expect(context.apiKey).toBeNull();
    });

    it("reports an invalid API key without creating a session", async () => {
        authMocks.getApiKeyFromHeaders.mockReturnValue("bad-key");
        authMocks.verifyApiKey.mockResolvedValue({ valid: false, key: null });

        const context = await createContext({ headers: new Headers() });

        expect(authMocks.verifyApiKey).toHaveBeenCalledWith({
            body: { key: "bad-key" },
        });
        expect(context.authType).toBe("apiKey");
        expect(context.apiKey).toEqual({
            error: "invalid",
            keyId: null,
            organizationId: null,
        });
        expect(context.session).toBeNull();
    });

    it.each([
        undefined,
        " org-1 ",
    ])("binds a valid API key to its organization with header %s", async (organizationHeader) => {
        authMocks.getApiKeyFromHeaders.mockReturnValue("valid-key");
        authMocks.verifyApiKey.mockResolvedValue({
            valid: true,
            key: { id: "key-1", referenceId: "org-1" },
        });
        const headers = new Headers();
        if (organizationHeader) {
            headers.set("x-organization-id", organizationHeader);
        }

        const context = await createContext({ headers });

        expect(context.apiKey).toEqual({
            error: null,
            keyId: "key-1",
            organizationId: "org-1",
        });
        expect(context.session).toEqual(
            expect.objectContaining({
                session: expect.objectContaining({
                    id: "key-1",
                    activeOrganizationId: "org-1",
                }),
                user: expect.objectContaining({
                    id: "api-key:key-1",
                    name: "API key",
                }),
            }),
        );
    });

    it("rejects an organization header that does not match the API key", async () => {
        authMocks.getApiKeyFromHeaders.mockReturnValue("valid-key");
        authMocks.verifyApiKey.mockResolvedValue({
            valid: true,
            key: { id: "key-1", referenceId: "org-1" },
        });

        const context = await createContext({
            headers: new Headers({ "x-organization-id": "org-2" }),
        });

        expect(context.apiKey).toEqual({
            error: "not_member",
            keyId: null,
            organizationId: null,
        });
        expect(context.session).toBeNull();
    });

    it("overrides an existing session's active organization with the API key", async () => {
        const session = createSession();
        authMocks.getSession.mockResolvedValue(session);
        authMocks.getApiKeyFromHeaders.mockReturnValue("valid-key");
        authMocks.verifyApiKey.mockResolvedValue({
            valid: true,
            key: { id: "key-1", referenceId: "org-1" },
        });

        const context = await createContext({ headers: new Headers() });

        expect(context.session?.session.activeOrganizationId).toBe("org-1");
        expect(context.session?.user).toBe(session.user);
        expect(session.session.activeOrganizationId).toBe("org-old");
    });
});
