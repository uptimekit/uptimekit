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
				before: async () => {
					const isSelfHosted = process.env.NEXT_PUBLIC_SELFHOSTED === "true";

					if (isSelfHosted) {
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
