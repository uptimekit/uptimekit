import { randomUUID } from "node:crypto";
import { apiKey } from "@better-auth/api-key";
import { db } from "@uptimekit/db";
import * as schema from "@uptimekit/db/schema/auth";
import type { Auth, BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import { admin, organization, twoFactor } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { eq } from "drizzle-orm";

export const API_KEY_HEADER = "x-api-key";
export const API_KEY_ORGANIZATION_HEADER = "x-organization-id";

export function getApiKeyFromHeaders(headers: Headers | null | undefined) {
	const headerApiKey = headers?.get(API_KEY_HEADER)?.trim();
	if (headerApiKey) {
		return headerApiKey;
	}

	const authorization = headers?.get("authorization")?.trim();
	if (!authorization) {
		return null;
	}

	const [scheme, token] = authorization.split(/\s+/, 2);
	if (scheme?.toLowerCase() !== "bearer" || !token) {
		return null;
	}

	return token.trim() || null;
}

export interface UptimeKitAuthSession {
	session: {
		id: string;
		token: string;
		userId: string;
		expiresAt: Date;
		createdAt: Date;
		updatedAt: Date;
		ipAddress?: string | null;
		userAgent?: string | null;
		impersonatedBy?: string | null;
		activeOrganizationId?: string | null;
	};
	user: {
		id: string;
		name: string;
		email: string;
		emailVerified: boolean;
		createdAt: Date;
		updatedAt: Date;
		image?: string | null;
		role?: string | null;
		banned?: boolean | null;
		banReason?: string | null;
		banExpires?: Date | null;
		twoFactorEnabled?: boolean | null;
	};
}

function createSlugFromEmail(email: string): string {
	const prefix = email.split("@")[0] || "user";
	return prefix.replace(/[^a-z0-9]/gi, "").toLowerCase() || "user";
}

async function createUniqueOrganizationSlug(email: string): Promise<string> {
	const baseSlug = createSlugFromEmail(email);

	for (let index = 0; index < 10; index++) {
		const candidate = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
		const [existingOrganization] = await db
			.select({ id: schema.organization.id })
			.from(schema.organization)
			.where(eq(schema.organization.slug, candidate))
			.limit(1);

		if (!existingOrganization) {
			return candidate;
		}
	}

	return `${baseSlug}-${randomUUID().slice(0, 8)}`;
}

const organizationAccessControl = createAccessControl({
	organization: ["update", "delete"],
	member: ["create", "update", "delete"],
	invitation: ["create", "cancel"],
	team: ["create", "update", "delete"],
	ac: ["create", "read", "update", "delete"],
	apiKey: ["create", "read", "update", "delete"],
});

const organizationRoles = {
	admin: organizationAccessControl.newRole({
		organization: ["update"],
		invitation: ["create", "cancel"],
		member: ["create", "update", "delete"],
		team: ["create", "update", "delete"],
		ac: ["create", "read", "update", "delete"],
		apiKey: ["create", "read", "update", "delete"],
	}),
	member: organizationAccessControl.newRole({
		organization: [],
		member: [],
		invitation: [],
		team: [],
		ac: ["read"],
		apiKey: [],
	}),
	owner: organizationAccessControl.newRole({
		organization: ["update", "delete"],
		member: ["create", "update", "delete"],
		invitation: ["create", "cancel"],
		team: ["create", "update", "delete"],
		ac: ["create", "read", "update", "delete"],
		apiKey: ["create", "read", "update", "delete"],
	}),
};

const authBaseUrl =
	process.env.BETTER_AUTH_URL ||
	process.env.APP_URL ||
	process.env.NEXT_PUBLIC_URL;
const trustedOrigins = Array.from(
	new Set([authBaseUrl, process.env.NEXT_PUBLIC_URL].filter(Boolean)),
) as string[];

const authConfig: BetterAuthOptions = {
	baseURL: authBaseUrl,
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: schema,
	}),
	trustedOrigins,
	emailAndPassword: {
		enabled: true,
	},
	plugins: [
		admin(),
		organization({
			ac: organizationAccessControl,
			allowUserToCreateOrganization: (user) => user.role === "admin",
			organizationHooks: {
				beforeCreateOrganization: async ({ organization }) => {
					return {
						data: {
							...organization,
						},
					};
				},
			},
			roles: organizationRoles,
		}),
		twoFactor({
			issuer: "UptimeKit",
		}),
		apiKey({
			customAPIKeyGetter: (ctx) => getApiKeyFromHeaders(ctx.headers),
			defaultPrefix: "uk_api_",
			enableMetadata: true,
			rateLimit: {
				enabled: true,
				maxRequests: 120,
				timeWindow: 60 * 1000,
			},
			references: "organization",
		}) as unknown as BetterAuthPlugin,
		nextCookies(),
	],
	socialProviders: {
		discord: {
			clientId: process.env.DISCORD_CLIENT_ID || "",
			clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
			enabled: !!(
				process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
			),
		},
		github: {
			clientId: process.env.GITHUB_CLIENT_ID || "",
			clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
			enabled: !!(
				process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
			),
		},
	},
	databaseHooks: {
		user: {
			create: {
				before: async (user, ctx) => {
					const [invite] = await db
						.select()
						.from(schema.invitation)
						.where(eq(schema.invitation.email, user.email))
						.limit(1);
					if (invite) {
						return;
					}

					const isAdminCreate =
						(ctx as { path?: string } | null | undefined)?.path ===
						"/admin/create-user";
					if (isAdminCreate) {
						return;
					}

					const isRegistrationEnabled =
						process.env.ENABLE_REGISTRATION === "true";

					if (!isRegistrationEnabled) {
						throw new Error("Registration is disabled on this instance.");
					}
				},
				after: async (user) => {
					const users = await db
						.select({ id: schema.user.id })
						.from(schema.user)
						.limit(2);
					const isFirstUser = users.length === 1;

					if (isFirstUser) {
						await db
							.update(schema.user)
							.set({ role: "admin" })
							.where(eq(schema.user.id, user.id));
					}

					const [invite] = await db
						.select()
						.from(schema.invitation)
						.where(eq(schema.invitation.email, user.email))
						.limit(1);

					if (invite) {
						return;
					}

					const slug = await createUniqueOrganizationSlug(user.email);

					await auth.api.createOrganization({
						body: {
							name: slug,
							slug: slug,
							userId: user.id,
						},
					});
				},
			},
		},
		session: {
			create: {
				after: async (session) => {
					if (!session.activeOrganizationId) {
						const membership = await db
							.select({ organizationId: schema.member.organizationId })
							.from(schema.member)
							.where(eq(schema.member.userId, session.userId))
							.limit(1);

						if (membership.length > 0 && membership[0]) {
							await db
								.update(schema.session)
								.set({ activeOrganizationId: membership[0].organizationId })
								.where(eq(schema.session.id, session.id));
						}
					}
				},
			},
		},
	},
};

type UptimeKitAuthApi = Omit<Auth["api"], "getSession"> &
	Record<string, any> & {
		getSession: (
			...args: Parameters<Auth["api"]["getSession"]>
		) => Promise<UptimeKitAuthSession | null>;
	};

type UptimeKitAuth = Omit<Auth, "api"> & {
	api: UptimeKitAuthApi;
};

export const auth = betterAuth(authConfig) as UptimeKitAuth;
