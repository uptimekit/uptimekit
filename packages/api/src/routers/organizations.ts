import { randomUUID } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { auth } from "@uptimekit/auth";
import {
	getOidcDiscoveryUrl,
	getOrganizationOidcProviderId,
	normalizeOidcDomains,
	normalizeOidcIssuer,
	normalizeOidcScopes,
} from "@uptimekit/auth/organization-oidc";
import { db } from "@uptimekit/db";
import {
	session as authSession,
	member,
	organization,
	organizationOidcProvider,
	user,
} from "@uptimekit/db/schema/auth";
import { monitor } from "@uptimekit/db/schema/monitors";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure, protectedProcedure, writeProcedure } from "../index";
import {
	applyOrganizationLimitChanges,
	getOrganizationQuotaState,
} from "../lib/organization-limits";

const organizationLimitSchema = z
	.number()
	.int()
	.min(1)
	.nullable()
	.optional()
	.transform((value) => value ?? null);

const organizationSlugSchema = z
	.string()
	.trim()
	.min(2)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
		message:
			"Slug must use lowercase letters, numbers, and single hyphens between words.",
	});

const oidcDomainSchema = z
	.string()
	.trim()
	.toLowerCase()
	.transform((domain) => domain.replace(/^@/, ""))
	.refine(
		(domain) =>
			/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
				domain,
			),
		{
			message: "Enter a valid email domain, for example example.com.",
		},
	);

const oidcProviderInputSchema = z.object({
	name: z.string().trim().min(2).max(80),
	enabled: z.boolean(),
	issuer: z.string().trim().url(),
	discoveryUrl: z.string().trim().url().nullable().optional(),
	clientId: z.string().trim().min(1),
	clientSecret: z
		.string()
		.optional()
		.transform((secret) => {
			const trimmedSecret = secret?.trim();
			return trimmedSecret || undefined;
		}),
	domains: z.array(oidcDomainSchema).min(1).transform(normalizeOidcDomains),
	scopes: z.array(z.string().trim().min(1)).min(1),
});

async function getOrganizationOrThrow(id: string) {
	const [org] = await db
		.select()
		.from(organization)
		.where(eq(organization.id, id))
		.limit(1);

	if (!org) {
		throw new ORPCError("NOT_FOUND", { message: "Organization not found" });
	}

	return org;
}

async function assertSlugAvailable(slug: string, organizationId?: string) {
	const [existingOrganization] = await db
		.select({ id: organization.id })
		.from(organization)
		.where(eq(organization.slug, slug))
		.limit(1);

	if (existingOrganization && existingOrganization.id !== organizationId) {
		throw new ORPCError("CONFLICT", { message: "Slug already taken" });
	}
}

async function getOwnerUserId(ownerEmail: string) {
	const [owner] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.email, ownerEmail.toLowerCase()))
		.limit(1);

	if (!owner) {
		throw new ORPCError("NOT_FOUND", { message: "Owner user not found" });
	}

	return owner.id;
}

function getActiveOrganizationIdOrThrow(
	session: { activeOrganizationId?: string | null } | null | undefined,
) {
	if (!session?.activeOrganizationId) {
		throw new ORPCError("UNAUTHORIZED", { message: "No active organization" });
	}

	return session.activeOrganizationId;
}

function toOidcProviderResponse(
	provider: typeof organizationOidcProvider.$inferSelect,
) {
	return {
		id: provider.id,
		name: provider.name,
		enabled: provider.enabled,
		issuer: provider.issuer,
		discoveryUrl: provider.discoveryUrl,
		clientId: provider.clientId,
		clientSecretConfigured: provider.clientSecret.length > 0,
		domains: provider.domains,
		scopes: provider.scopes,
		callbackPath: `/api/auth/oauth2/callback/${getOrganizationOidcProviderId(
			provider.id,
		)}`,
		createdAt: provider.createdAt,
		updatedAt: provider.updatedAt,
	};
}

export const organizationsRouter = {
	list: adminProcedure
		.route({
			method: "GET",
			path: "/admin/organizations",
			tags: ["Admin - Organizations"],
			summary: "List all organizations",
			description:
				"List all organizations with member and monitor counts. Admin only.",
		})
		.input(
			z
				.object({
					q: z.string().optional(),
					limit: z.number().default(50),
					offset: z.number().default(0),
				})
				.optional(),
		)
		.handler(async ({ input }) => {
			const filters = [];

			if (input?.q) {
				filters.push(
					or(
						ilike(organization.name, `%${input.q}%`),
						ilike(organization.slug, `%${input.q}%`),
					),
				);
			}

			const whereClause = filters.length > 0 ? and(...filters) : undefined;

			// Get organizations with member count using subquery
			const orgsWithCounts = await db
				.select({
					id: organization.id,
					name: organization.name,
					slug: organization.slug,
					logo: organization.logo,
					activeMonitorLimit: organization.activeMonitorLimit,
					regionsPerMonitorLimit: organization.regionsPerMonitorLimit,
					createdAt: organization.createdAt,
					memberCount:
						sql<number>`(SELECT COUNT(*) FROM "member" WHERE "member"."organization_id" = "organization"."id")`
							.mapWith(Number)
							.as("member_count"),
					totalMonitorCount:
						sql<number>`(SELECT COUNT(*) FROM "monitor" WHERE "monitor"."organization_id" = "organization"."id")`
							.mapWith(Number)
							.as("total_monitor_count"),
					activeMonitorCount:
						sql<number>`(SELECT COUNT(*) FROM "monitor" WHERE "monitor"."organization_id" = "organization"."id" AND "monitor"."active" = true)`
							.mapWith(Number)
							.as("active_monitor_count"),
				})
				.from(organization)
				.where(whereClause)
				.orderBy(desc(organization.createdAt))
				.limit(input?.limit || 50)
				.offset(input?.offset || 0);

			const [totalResult] = await db
				.select({ count: count() })
				.from(organization)
				.where(whereClause);

			return {
				items: orgsWithCounts,
				total: totalResult?.count || 0,
			};
		}),

	create: adminProcedure
		.route({
			method: "POST",
			path: "/admin/organizations",
			tags: ["Admin - Organizations"],
			summary: "Create organization",
			description:
				"Create an organization for an existing owner user. Admin only.",
		})
		.input(
			z.object({
				name: z.string().trim().min(2),
				slug: organizationSlugSchema,
				logo: z.string().trim().nullable().optional(),
				ownerEmail: z.string().trim().email(),
				activeMonitorLimit: organizationLimitSchema,
				regionsPerMonitorLimit: organizationLimitSchema,
			}),
		)
		.handler(async ({ input }) => {
			await assertSlugAvailable(input.slug);
			const ownerUserId = await getOwnerUserId(input.ownerEmail);

			const created = await auth.api.createOrganization({
				body: {
					name: input.name,
					slug: input.slug,
					logo: input.logo || undefined,
					userId: ownerUserId,
				},
			});

			const [updated] = await db
				.update(organization)
				.set({
					activeMonitorLimit: input.activeMonitorLimit,
					regionsPerMonitorLimit: input.regionsPerMonitorLimit,
				})
				.where(eq(organization.id, created.id))
				.returning();

			return updated ?? created;
		}),

	get: adminProcedure
		.route({
			method: "GET",
			path: "/admin/organizations/{id}",
			tags: ["Admin - Organizations"],
			summary: "Get organization details",
			description:
				"Get detailed organization information with members. Admin only.",
		})
		.input(z.object({ id: z.string() }))
		.handler(async ({ input }) => {
			const org = await db.query.organization.findFirst({
				where: eq(organization.id, input.id),
				with: {
					members: {
						with: {
							user: {
								columns: {
									id: true,
									name: true,
									email: true,
									image: true,
								},
							},
						},
					},
				},
			});

			if (!org) {
				return null;
			}

			const [monitorCountResult] = await db
				.select({ count: count() })
				.from(monitor)
				.where(eq(monitor.organizationId, input.id));

			return {
				...org,
				monitorCount: monitorCountResult?.count || 0,
			};
		}),

	updateLimits: adminProcedure
		.route({
			method: "PATCH",
			path: "/admin/organizations/{id}/limits",
			tags: ["Admin - Organizations"],
			summary: "Update organization quota limits",
			description:
				"Update per-organization monitor and region limits and auto-pause monitors when needed.",
		})
		.input(
			z.object({
				id: z.string(),
				activeMonitorLimit: organizationLimitSchema,
				regionsPerMonitorLimit: organizationLimitSchema,
			}),
		)
		.handler(async ({ input }) => {
			const result = await applyOrganizationLimitChanges({
				organizationId: input.id,
				activeMonitorLimit: input.activeMonitorLimit,
				regionsPerMonitorLimit: input.regionsPerMonitorLimit,
			});

			return result;
		}),

	update: adminProcedure
		.route({
			method: "PUT",
			path: "/admin/organizations/{id}",
			tags: ["Admin - Organizations"],
			summary: "Update organization",
			description:
				"Update organization profile fields and quota limits. Admin only.",
		})
		.input(
			z.object({
				id: z.string(),
				name: z.string().trim().min(2),
				slug: organizationSlugSchema,
				logo: z.string().trim().nullable().optional(),
				activeMonitorLimit: organizationLimitSchema,
				regionsPerMonitorLimit: organizationLimitSchema,
			}),
		)
		.handler(async ({ input }) => {
			await getOrganizationOrThrow(input.id);
			await assertSlugAvailable(input.slug, input.id);

			const quotaResult = await applyOrganizationLimitChanges({
				organizationId: input.id,
				activeMonitorLimit: input.activeMonitorLimit,
				regionsPerMonitorLimit: input.regionsPerMonitorLimit,
			});

			const [updated] = await db
				.update(organization)
				.set({
					name: input.name,
					slug: input.slug,
					logo: input.logo || null,
				})
				.where(eq(organization.id, input.id))
				.returning();

			if (!updated) {
				throw new ORPCError("NOT_FOUND", { message: "Organization not found" });
			}

			return {
				organization: updated,
				...quotaResult,
			};
		}),

	delete: adminProcedure
		.route({
			method: "DELETE",
			path: "/admin/organizations/{id}",
			tags: ["Admin - Organizations"],
			summary: "Delete organization",
			description:
				"Hard-delete an organization and its cascaded resources. Admin only.",
		})
		.input(z.object({ id: z.string() }))
		.handler(async ({ input }) => {
			const org = await getOrganizationOrThrow(input.id);

			await db.transaction(async (tx) => {
				await tx
					.update(authSession)
					.set({ activeOrganizationId: null })
					.where(eq(authSession.activeOrganizationId, input.id));
				await tx.delete(member).where(eq(member.organizationId, input.id));
				await tx.delete(organization).where(eq(organization.id, input.id));
			});

			return { success: true, organization: org };
		}),

	getActiveQuota: protectedProcedure
		.route({
			method: "GET",
			path: "/organizations/active/quota",
			tags: ["Organizations"],
			summary: "Get active organization quotas",
			description:
				"Return the active organization's configured limits and current monitor usage.",
		})
		.handler(async ({ context }) => {
			const organizationId = context.session.session.activeOrganizationId;

			if (!organizationId) {
				return null;
			}

			return getOrganizationQuotaState(organizationId);
		}),

	getActiveOidcProvider: writeProcedure
		.route({
			method: "GET",
			path: "/organizations/active/oidc-provider",
			tags: ["Organizations"],
			summary: "Get active organization OIDC provider",
			description:
				"Return the active organization's OIDC single sign-on provider settings.",
		})
		.handler(async ({ context }) => {
			const organizationId = getActiveOrganizationIdOrThrow(
				context.session.session,
			);

			const [provider] = await db
				.select()
				.from(organizationOidcProvider)
				.where(eq(organizationOidcProvider.organizationId, organizationId))
				.limit(1);

			return provider ? toOidcProviderResponse(provider) : null;
		}),

	upsertActiveOidcProvider: writeProcedure
		.route({
			method: "PUT",
			path: "/organizations/active/oidc-provider",
			tags: ["Organizations"],
			summary: "Update active organization OIDC provider",
			description:
				"Create or update the active organization's OIDC single sign-on provider settings.",
		})
		.input(oidcProviderInputSchema)
		.handler(async ({ context, input }) => {
			const organizationId = getActiveOrganizationIdOrThrow(
				context.session.session,
			);
			const [existingProvider] = await db
				.select()
				.from(organizationOidcProvider)
				.where(eq(organizationOidcProvider.organizationId, organizationId))
				.limit(1);
			const clientSecret = input.clientSecret ?? existingProvider?.clientSecret;

			if (!clientSecret) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Client secret is required before enabling OIDC sign-in.",
				});
			}

			const values = {
				name: input.name,
				enabled: input.enabled,
				issuer: normalizeOidcIssuer(input.issuer),
				discoveryUrl: getOidcDiscoveryUrl(input.issuer, input.discoveryUrl),
				clientId: input.clientId,
				clientSecret,
				domains: input.domains,
				scopes: normalizeOidcScopes(input.scopes),
			};

			if (existingProvider) {
				const [updatedProvider] = await db
					.update(organizationOidcProvider)
					.set(values)
					.where(eq(organizationOidcProvider.id, existingProvider.id))
					.returning();

				if (!updatedProvider) {
					throw new ORPCError("NOT_FOUND", {
						message: "OIDC provider not found",
					});
				}

				return toOidcProviderResponse(updatedProvider);
			}

			const [createdProvider] = await db
				.insert(organizationOidcProvider)
				.values({
					id: randomUUID(),
					organizationId,
					...values,
				})
				.returning();

			if (!createdProvider) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create OIDC provider",
				});
			}

			return toOidcProviderResponse(createdProvider);
		}),

	deleteActiveOidcProvider: writeProcedure
		.route({
			method: "DELETE",
			path: "/organizations/active/oidc-provider",
			tags: ["Organizations"],
			summary: "Delete active organization OIDC provider",
			description:
				"Remove the active organization's OIDC single sign-on provider settings.",
		})
		.handler(async ({ context }) => {
			const organizationId = getActiveOrganizationIdOrThrow(
				context.session.session,
			);

			await db
				.delete(organizationOidcProvider)
				.where(eq(organizationOidcProvider.organizationId, organizationId));

			return { success: true };
		}),
};
