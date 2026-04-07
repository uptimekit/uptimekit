import { db } from "@uptimekit/db";
import * as schema from "@uptimekit/db/schema/auth";
import { configuration } from "@uptimekit/db/schema/configuration";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, organization, twoFactor } from "better-auth/plugins";
import { eq } from "drizzle-orm";

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
		organization({
			organizationHooks: {
				beforeCreateOrganization: async ({ organization }) => {
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
					const [invite] = await db
						.select()
						.from(schema.invitation)
						.where(eq(schema.invitation.email, user.email))
						.limit(1);
					if (invite) {
						return;
					}

					const [config] = await db
						.select()
						.from(configuration)
						.where(eq(configuration.key, "registration_enabled"))
						.limit(1);

					const isRegistrationEnabled = config?.value === "true";

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
