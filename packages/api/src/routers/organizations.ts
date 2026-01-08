import { db } from "@uptimekit/db";
import { organization } from "@uptimekit/db/schema/auth";
import { monitor } from "@uptimekit/db/schema/monitors";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure } from "../index";

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
					createdAt: organization.createdAt,
					memberCount:
						sql<number>`(SELECT COUNT(*) FROM "member" WHERE "member"."organization_id" = "organization"."id")`.as(
							"member_count",
						),
					monitorCount:
						sql<number>`(SELECT COUNT(*) FROM "monitor" WHERE "monitor"."organization_id" = "organization"."id")`.as(
							"monitor_count",
						),
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
};
