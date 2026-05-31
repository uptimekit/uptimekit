import {
	API_KEY_ORGANIZATION_HEADER,
	auth,
	getApiKeyFromHeaders,
	type UptimeKitAuthSession,
} from "@uptimekit/auth";

export interface ContextHeaders {
	get(name: string): string | null;
}

type ApiKeyContext =
	| {
			error: null;
			keyId: string;
			organizationId: string;
	  }
	| {
			error: "invalid" | "not_member";
			keyId: null;
			organizationId: null;
	  };

export interface Context {
	apiKey: ApiKeyContext | null;
	authType: "anonymous" | "apiKey" | "session";
	headers: ContextHeaders;
	session: UptimeKitAuthSession | null;
}

interface ContextRequest {
	headers: Headers;
}

interface VerifiedApiKey {
	id: string;
	referenceId: string;
}

function createApiKeySession(
	apiKey: VerifiedApiKey,
	organizationId: string,
): UptimeKitAuthSession {
	const now = new Date();

	return {
		session: {
			id: apiKey.id,
			token: apiKey.id,
			userId: `api-key:${apiKey.id}`,
			expiresAt: now,
			createdAt: now,
			updatedAt: now,
			activeOrganizationId: organizationId,
		},
		user: {
			id: `api-key:${apiKey.id}`,
			name: "API key",
			email: "",
			emailVerified: true,
			createdAt: now,
			updatedAt: now,
		},
	};
}

async function resolveApiKeyOrganization(
	headers: ContextHeaders,
	apiKey: string,
): Promise<ApiKeyContext> {
	const data = await auth.api.verifyApiKey({
		body: {
			key: apiKey,
		},
	});

	if (!data.valid || !data.key?.referenceId) {
		return {
			error: "invalid",
			keyId: null,
			organizationId: null,
		};
	}

	const organizationId = headers.get(API_KEY_ORGANIZATION_HEADER)?.trim();
	if (organizationId && organizationId !== data.key.referenceId) {
		return {
			error: "not_member",
			keyId: null,
			organizationId: null,
		};
	}

	return {
		error: null,
		keyId: data.key.id,
		organizationId: data.key.referenceId,
	};
}

function withActiveOrganization(
	session: UptimeKitAuthSession,
	organizationId: string | null,
): UptimeKitAuthSession {
	if (!organizationId) {
		return session;
	}

	return {
		...session,
		session: {
			...session.session,
			activeOrganizationId: organizationId,
		},
	};
}

export async function createContext(req: ContextRequest): Promise<Context> {
	const session = await auth.api.getSession({
		headers: req.headers,
	});

	const apiKey = getApiKeyFromHeaders(req.headers);
	if (!apiKey) {
		return {
			apiKey: null,
			authType: session?.user ? ("session" as const) : ("anonymous" as const),
			headers: req.headers,
			session,
		};
	}

	const apiKeyOrganization = await resolveApiKeyOrganization(
		req.headers,
		apiKey,
	);

	return {
		apiKey: apiKeyOrganization,
		authType: "apiKey" as const,
		headers: req.headers,
		session:
			apiKeyOrganization.error === null
				? withActiveOrganization(
						session ??
							createApiKeySession(
								{
									id: apiKeyOrganization.keyId,
									referenceId: apiKeyOrganization.organizationId,
								},
								apiKeyOrganization.organizationId,
							),
						apiKeyOrganization.organizationId,
					)
				: session,
	};
}
