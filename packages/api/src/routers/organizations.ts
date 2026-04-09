import { db } from "@uptimekit/db";
import { organization } from "@uptimekit/db/schema/auth";
import { monitor } from "@uptimekit/db/schema/monitors";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure, protectedProcedure } from "../index";
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

export const organizationsRouter = {
	list: adminProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/admin/organizations",
				tags: ["Admin - Organizations"],
				summary: "List all organizations",
				description:
					"List all organizations with member and monitor counts. Admin only.",
			},
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

	get: adminProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/admin/organizations/{id}",
				tags: ["Admin - Organizations"],
				summary: "Get organization details",
				description:
					"Get detailed organization information with members. Admin only.",
			},
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
		.meta({
			openapi: {
				method: "PATCH",
				path: "/admin/organizations/{id}/limits",
				tags: ["Admin - Organizations"],
				summary: "Update organization quota limits",
				description:
					"Update per-organization monitor and region limits and auto-pause monitors when needed.",
			},
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

	getActiveQuota: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/organizations/active/quota",
				tags: ["Organizations"],
				summary: "Get active organization quotas",
				description:
					"Return the active organization's configured limits and current monitor usage.",
			},
		})
		.handler(async ({ context }) => {
			const organizationId = context.session.session.activeOrganizationId;

			if (!organizationId) {
				return null;
			}

			return getOrganizationQuotaState(organizationId);
		}),
};
