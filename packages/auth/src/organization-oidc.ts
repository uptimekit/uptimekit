import { randomUUID } from "node:crypto";
import { db } from "@uptimekit/db";
import * as schema from "@uptimekit/db/schema/auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import type { GenericOAuthConfig } from "better-auth/plugins/generic-oauth";
import type { BetterAuthPlugin } from "better-auth/types";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const ORGANIZATION_OIDC_PROVIDER_PREFIX = "organization-oidc-";

export const DEFAULT_ORGANIZATION_OIDC_SCOPES = [
	"openid",
	"email",
	"profile",
] as const;

type OrganizationOidcProvider =
	typeof schema.organizationOidcProvider.$inferSelect;

export const organizationOidcOAuthConfigs: GenericOAuthConfig[] = [];

export function normalizeOidcIssuer(issuer: string) {
	return issuer.trim().replace(/\/+$/, "");
}

export function getOidcDiscoveryUrl(
	issuer: string,
	discoveryUrl?: string | null,
) {
	const normalizedDiscoveryUrl = discoveryUrl?.trim().replace(/\/+$/, "");
	if (normalizedDiscoveryUrl) {
		return normalizedDiscoveryUrl;
	}

	return `${normalizeOidcIssuer(issuer)}/.well-known/openid-configuration`;
}

export function normalizeOidcDomains(domains: string[]) {
	return Array.from(
		new Set(
			domains
				.map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
				.filter(Boolean),
		),
	).sort();
}

export function normalizeOidcScopes(scopes: string[]) {
	return Array.from(
		new Set(
			[...DEFAULT_ORGANIZATION_OIDC_SCOPES, ...scopes]
				.map((scope) => scope.trim())
				.filter(Boolean),
		),
	);
}

export function getOrganizationOidcProviderId(providerId: string) {
	return `${ORGANIZATION_OIDC_PROVIDER_PREFIX}${providerId}`;
}

export function getProviderIdFromOrganizationOidcProviderId(
	providerId: string,
) {
	if (!providerId.startsWith(ORGANIZATION_OIDC_PROVIDER_PREFIX)) {
		return null;
	}

	return providerId.slice(ORGANIZATION_OIDC_PROVIDER_PREFIX.length) || null;
}

function getEmailDomain(email: string) {
	const domain = email.trim().toLowerCase().split("@").at(1);
	return domain || null;
}

function getStringProfileValue(
	profile: Record<string, unknown>,
	key: string,
): string | undefined {
	const value = profile[key];
	return typeof value === "string" && value.trim() ? value : undefined;
}

function toGenericOAuthConfig(
	provider: OrganizationOidcProvider,
): GenericOAuthConfig {
	const providerId = getOrganizationOidcProviderId(provider.id);

	return {
		providerId,
		clientId: provider.clientId,
		clientSecret: provider.clientSecret,
		discoveryUrl: provider.discoveryUrl,
		issuer: provider.issuer,
		scopes: provider.scopes,
		pkce: true,
		authorizationUrlParams: (ctx): Record<string, string> => {
			const email = (ctx.body as { additionalData?: { email?: unknown } })
				?.additionalData?.email;

			return typeof email === "string" && email.trim()
				? { login_hint: email.trim().toLowerCase() }
				: {};
		},
		mapProfileToUser: (profile) => {
			const id =
				getStringProfileValue(profile, "sub") ??
				getStringProfileValue(profile, "id");
			const email = getStringProfileValue(profile, "email");
			const name =
				getStringProfileValue(profile, "name") ??
				getStringProfileValue(profile, "preferred_username") ??
				email ??
				"OIDC User";
			const emailVerified =
				profile.email_verified !== false && profile.emailVerified !== false;

			return {
				...(id ? { id } : {}),
				...(email ? { email: email.toLowerCase() } : {}),
				emailVerified,
				name,
				image: getStringProfileValue(profile, "picture"),
			};
		},
		overrideUserInfo: true,
	};
}

function upsertGenericOAuthConfig(provider: OrganizationOidcProvider) {
	const config = toGenericOAuthConfig(provider);
	const existingIndex = organizationOidcOAuthConfigs.findIndex(
		(existingConfig) => existingConfig.providerId === config.providerId,
	);

	if (existingIndex >= 0) {
		organizationOidcOAuthConfigs[existingIndex] = config;
	} else {
		organizationOidcOAuthConfigs.push(config);
	}

	return config.providerId;
}

async function getProviderById(providerId: string) {
	const provider = await db.query.organizationOidcProvider.findFirst({
		where: and(
			eq(schema.organizationOidcProvider.id, providerId),
			eq(schema.organizationOidcProvider.enabled, true),
		),
	});

	return provider ?? null;
}

export async function getOrganizationOidcProviderForEmail(email: string) {
	const domain = getEmailDomain(email);
	if (!domain) {
		return null;
	}

	const providers = await db
		.select({
			id: schema.organizationOidcProvider.id,
			organizationId: schema.organizationOidcProvider.organizationId,
			name: schema.organizationOidcProvider.name,
			enabled: schema.organizationOidcProvider.enabled,
			issuer: schema.organizationOidcProvider.issuer,
			discoveryUrl: schema.organizationOidcProvider.discoveryUrl,
			clientId: schema.organizationOidcProvider.clientId,
			clientSecret: schema.organizationOidcProvider.clientSecret,
			domains: schema.organizationOidcProvider.domains,
			scopes: schema.organizationOidcProvider.scopes,
			createdAt: schema.organizationOidcProvider.createdAt,
			updatedAt: schema.organizationOidcProvider.updatedAt,
			organizationName: schema.organization.name,
		})
		.from(schema.organizationOidcProvider)
		.innerJoin(
			schema.organization,
			eq(
				schema.organizationOidcProvider.organizationId,
				schema.organization.id,
			),
		)
		.where(eq(schema.organizationOidcProvider.enabled, true));

	return (
		providers.find((provider) =>
			normalizeOidcDomains(provider.domains).includes(domain),
		) ?? null
	);
}

export async function ensureOrganizationOidcProviderConfig(
	betterAuthProviderId: string,
) {
	const providerId =
		getProviderIdFromOrganizationOidcProviderId(betterAuthProviderId);
	if (!providerId) {
		return null;
	}

	const provider = await getProviderById(providerId);
	if (!provider) {
		return null;
	}

	return upsertGenericOAuthConfig(provider);
}

export async function getOrganizationIdForOidcProviderId(
	betterAuthProviderId: string,
) {
	const providerId =
		getProviderIdFromOrganizationOidcProviderId(betterAuthProviderId);
	if (!providerId) {
		return null;
	}

	const [provider] = await db
		.select({ organizationId: schema.organizationOidcProvider.organizationId })
		.from(schema.organizationOidcProvider)
		.where(eq(schema.organizationOidcProvider.id, providerId))
		.limit(1);

	return provider?.organizationId ?? null;
}

export function getOrganizationOidcProviderIdFromContext(
	context: unknown,
): string | null {
	const endpointContext = context as
		| {
				body?: { providerId?: unknown };
				params?: { id?: unknown; providerId?: unknown };
		  }
		| null
		| undefined;

	const providerId =
		endpointContext?.params?.providerId ??
		endpointContext?.body?.providerId ??
		endpointContext?.params?.id;

	return typeof providerId === "string" &&
		getProviderIdFromOrganizationOidcProviderId(providerId)
		? providerId
		: null;
}

export async function getOrganizationIdFromOidcContext(context: unknown) {
	const providerId = getOrganizationOidcProviderIdFromContext(context);
	if (!providerId) {
		return null;
	}

	return getOrganizationIdForOidcProviderId(providerId);
}

export async function ensureOrganizationOidcMembership(
	userId: string,
	organizationId: string,
) {
	const [existingMember] = await db
		.select({ id: schema.member.id })
		.from(schema.member)
		.where(
			and(
				eq(schema.member.userId, userId),
				eq(schema.member.organizationId, organizationId),
			),
		)
		.limit(1);

	if (existingMember) {
		return;
	}

	await db.insert(schema.member).values({
		id: randomUUID(),
		organizationId,
		userId,
		role: "member",
		createdAt: new Date(),
	});
}

async function getProviderIdFromOAuthRequest(
	request: Request,
	basePath: string,
) {
	const { pathname } = new URL(request.url);
	const authPath = pathname.startsWith(basePath)
		? pathname.slice(basePath.length) || "/"
		: pathname;

	if (authPath.startsWith("/oauth2/callback/")) {
		return decodeURIComponent(authPath.slice("/oauth2/callback/".length));
	}

	if (authPath !== "/sign-in/oauth2" || request.method !== "POST") {
		return null;
	}

	try {
		const body = (await request.clone().json()) as { providerId?: unknown };
		return typeof body.providerId === "string" ? body.providerId : null;
	} catch {
		return null;
	}
}

export function organizationOidcPlugin(): BetterAuthPlugin {
	return {
		id: "organization-oidc",
		endpoints: {
			lookupOrganizationOidcProvider: createAuthEndpoint(
				"/organization-oidc/lookup",
				{
					method: "POST",
					body: z.object({
						email: z.string().email(),
					}),
				},
				async (ctx) => {
					const provider = await getOrganizationOidcProviderForEmail(
						ctx.body.email,
					);

					if (!provider) {
						return ctx.json({ hasProvider: false });
					}

					const providerId = upsertGenericOAuthConfig(provider);

					return ctx.json({
						hasProvider: true,
						providerId,
						providerName: provider.name,
						organizationId: provider.organizationId,
						organizationName: provider.organizationName,
					});
				},
			),
		},
		onRequest: async (request, ctx) => {
			const basePath = new URL(ctx.baseURL).pathname.replace(/\/$/, "");
			const providerId = await getProviderIdFromOAuthRequest(request, basePath);

			if (!providerId) {
				return;
			}

			if (!getProviderIdFromOrganizationOidcProviderId(providerId)) {
				return;
			}

			const registeredProviderId =
				await ensureOrganizationOidcProviderConfig(providerId);

			if (!registeredProviderId) {
				throw new APIError("NOT_FOUND", {
					message: "OIDC provider not found",
				});
			}
		},
		rateLimit: [
			{
				pathMatcher: (path) => path === "/organization-oidc/lookup",
				window: 60,
				max: 20,
			},
		],
	};
}
