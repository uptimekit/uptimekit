import { db } from "@uptimekit/db";
import * as schema from "@uptimekit/db/schema/auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, apiKey, organization } from "better-auth/plugins";
import { eq } from "drizzle-orm";

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
	plugins: [nextCookies(), admin(), apiKey(), organization()],
	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					const isSelfHosted = process.env.NEXT_PUBLIC_SELFHOSTED === "true";

					// Count users to check if this is the first user
					const users = await db
						.select({ id: schema.user.id })
						.from(schema.user)
						.limit(2);
					const isFirstUser = users.length === 1;

					// Assign admin role if self-hosted and first user
					if (isSelfHosted && isFirstUser) {
						await db
							.update(schema.user)
							.set({ role: "admin" })
							.where(eq(schema.user.id, user.id));
					}

					// Create organization from email using better-auth API
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
					// If session doesn't have active organization, set the user's first org as active
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
