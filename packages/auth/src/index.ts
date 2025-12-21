import { db } from "@uptimekit/db";
import * as schema from "@uptimekit/db/schema/auth";
import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, apiKey, organization, twoFactor } from "better-auth/plugins";
import { and, eq } from "drizzle-orm";

// Helper to create slug from email
function createSlugFromEmail(email: string): string {
	const prefix = email.split("@")[0] || "user";
	return prefix.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",

		schema: schema,
	}),
	trustedOrigins: [process.env.NEXT_PUBLIC_URL || ""],
	emailAndPassword: {
		enabled: true,
	},
	plugins: [
		nextCookies(),
		admin(),
		apiKey(),
		organization({
			organizationHooks: {
				beforeCreateOrganization: async ({ organization, user }) => {
					const isSelfHosted = process.env.NEXT_PUBLIC_SELFHOSTED === "true";
					const MAX_ORGANIZATIONS = 3;

					if (!isSelfHosted) {
						if (user.id) {
							const memberships = await db
								.select()
								.from(schema.member)
								.where(
									and(
										eq(schema.member.userId, user.id),
										eq(schema.member.role, "owner"),
									),
								);

							if (memberships.length >= MAX_ORGANIZATIONS) {
								throw new APIError("BAD_REQUEST", {
									message: `Plan limit reached. You can only create up to ${MAX_ORGANIZATIONS} organizations.`,
								});
							}
						}
					}
					return {
						data: {
							...organization,
						},
					};
				},
			},
		}),
		twoFactor({
			issuer: "UptimeKit",
		}),
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
				before: async (user) => {
					const isSelfHosted = process.env.NEXT_PUBLIC_SELFHOSTED === "true";

					if (isSelfHosted) {
						const [invite] = await db
							.select()
							.from(schema.invitation)
							.where(eq(schema.invitation.email, user.email))
							.limit(1);

						if (invite) {
							return;
						}

						const users = await db
							.select({ id: schema.user.id })
							.from(schema.user)
							.limit(1);

						if (users.length > 0) {
							throw new Error("Registration is disabled on this instance.");
						}
					}
				},
				after: async (user) => {
					const isSelfHosted = process.env.NEXT_PUBLIC_SELFHOSTED === "true";

					const users = await db
						.select({ id: schema.user.id })
						.from(schema.user)
						.limit(2);
					const isFirstUser = users.length === 1;

					if (isSelfHosted && isFirstUser) {
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

					const slug = createSlugFromEmail(user.email);

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
});
