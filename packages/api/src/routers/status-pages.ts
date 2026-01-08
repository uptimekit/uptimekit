import { ORPCError } from "@orpc/server";
import { db } from "@uptimekit/db";
import {
	statusPage,
	statusPageGroup,
	statusPageMonitor,
} from "@uptimekit/db/schema/status-pages";
import { and, asc, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, writeProcedure } from "../index";
import { redis } from "../lib/redis";

export const statusPagesRouter = {
	list: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/status-pages",
				tags: ["Status Page Management"],
				summary: "List status pages",
				description:
					"Retrieve a list of status pages with optional searching and filtering.",
			},
		})
		.input(
			z
				.object({
					q: z.string().optional(),
					public: z.boolean().optional(),
					limit: z.number().default(50),
					offset: z.number().default(0),
				})
				.optional(),
		)
		.handler(async ({ input, context }) => {
			const filters = [
				eq(
					statusPage.organizationId,
					context.session.session.activeOrganizationId!,
				),
			];

			if (input?.q) {
				filters.push(ilike(statusPage.name, `%${input.q}%`));
			}

			if (input?.public !== undefined) {
				filters.push(eq(statusPage.public, input.public));
			}

			const [pages, total] = await Promise.all([
				db
					.select()
					.from(statusPage)
					.where(and(...filters))
					.orderBy(desc(statusPage.createdAt))
					.limit(input?.limit || 50)
					.offset(input?.offset || 0),
				db.$count(statusPage, and(...filters)),
			]);

			const items = await Promise.all(
				pages.map(async (page) => {
					const monitorCount = await db
						.select({ count: statusPageMonitor.monitorId })
						.from(statusPageMonitor)
						.where(eq(statusPageMonitor.statusPageId, page.id))
						.then((r) => r.length);

					// TODO: Implement subscriber count when subscribers table is ready
					const subscriberCount = 0;

					return {
						...page,
						monitorsCount: monitorCount,
						subscribers: subscriberCount,
					};
				}),
			);

			return {
				items,
				total,
			};
		}),

	create: writeProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/status-pages",
				tags: ["Status Page Management"],
				summary: "Create status page",
				description: "Create a new status page.",
			},
		})
		.input(
			z.object({
				name: z.string().min(1),
				slug: z.string().min(1),
				isPrivate: z.boolean().default(false),
			}),
		)
		.handler(async ({ input, context }) => {
			// Check for duplicate slug globally or per org? Usually globally for subdomains.
			const existing = await db.query.statusPage.findFirst({
				where: eq(statusPage.slug, input.slug),
			});

			if (existing) {
				throw new ORPCError("CONFLICT", { message: "Slug already taken" });
			}

			const [newPage] = await db
				.insert(statusPage)
				.values({
					id: crypto.randomUUID(),
					name: input.name,
					slug: input.slug,
					organizationId: context.session.session.activeOrganizationId!,
					public: !input.isPrivate,
				})
				.returning();

			return newPage;
		}),

	get: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/status-pages/{id}",
				tags: ["Status Page Management"],
				summary: "Get status page",
				description: "Retrieve details of a specific status page.",
			},
		})
		.input(z.object({ id: z.string() }))
		.handler(async ({ input, context }) => {
			const page = await db.query.statusPage.findFirst({
				where: and(
					eq(statusPage.id, input.id),
					eq(
						statusPage.organizationId,
						context.session.session.activeOrganizationId!,
					),
				),
			});

			if (!page) {
				throw new ORPCError("NOT_FOUND", { message: "Status page not found" });
			}

			return page;
		}),

	update: writeProcedure
		.meta({
			openapi: {
				method: "PATCH",
				path: "/status-pages/{id}",
				tags: ["Status Page Management"],
				summary: "Update status page",
				description: "Update the configuration of a status page.",
			},
		})
		.input(
			z.object({
				id: z.string(),
				name: z.string().optional(),
				slug: z.string().optional(),
				domain: z.string().optional().nullable(),
				websiteUrl: z.string().optional().nullable(),
				design: z
					.object({
						logoUrl: z.string().optional(),
						websiteUrl: z.string().optional(),
						contactUrl: z.string().optional(),
						theme: z.enum(["light", "dark"]).optional(),
						headerLayout: z.enum(["vertical", "horizontal"]).optional(),
					})
					.optional(),
				description: z.string().optional(),
				public: z.boolean().optional(),
			}),
		)
		.handler(async ({ input, context }) => {
			const existing = await db.query.statusPage.findFirst({
				where: and(
					eq(statusPage.id, input.id),
					eq(
						statusPage.organizationId,
						context.session.session.activeOrganizationId!,
					),
				),
			});

			if (!existing) {
				throw new ORPCError("NOT_FOUND");
			}

			// If updating slug, check uniqueness
			if (input.slug && input.slug !== existing.slug) {
				const slugTaken = await db.query.statusPage.findFirst({
					where: eq(statusPage.slug, input.slug),
				});
				if (slugTaken)
					throw new ORPCError("CONFLICT", { message: "Slug already taken" });
			}

			// Merge design
			const currentDesign = (existing.design as any) || {};
			const newDesign = input.design
				? { ...currentDesign, ...input.design }
				: currentDesign;

			await db
				.update(statusPage)
				.set({
					name: input.name,
					slug: input.slug,
					domain: input.domain,
					description: input.description,
					public: input.public,
					design: newDesign,
				})
				.where(eq(statusPage.id, input.id));

			// Invalidate cache
			if (existing.domain) {
				await redis.del(`status-page:${existing.domain}`);
			}
			if (input.domain && input.domain !== existing.domain) {
				await redis.del(`status-page:${input.domain}`);
			}

			return { success: true };
		}),

	// Structure management
	getStructure: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/status-pages/{id}/structure",
				tags: ["Status Page Management"],
				summary: "Get structure",
				description: "Get the layout structure of a status page.",
			},
		})
		.input(z.object({ id: z.string() }))
		.handler(async ({ input, context }) => {
			const existing = await db.query.statusPage.findFirst({
				where: and(
					eq(statusPage.id, input.id),
					eq(
						statusPage.organizationId,
						context.session.session.activeOrganizationId!,
					),
				),
			});
			if (!existing) throw new ORPCError("NOT_FOUND");

			// Fetch groups
			const groups = await db.query.statusPageGroup.findMany({
				where: eq(statusPageGroup.statusPageId, input.id),
				orderBy: asc(statusPageGroup.order),
				with: {
					monitors: {
						orderBy: asc(statusPageMonitor.order),
						with: {
							monitor: true,
						},
					},
				},
			});

			return {
				groups: groups.map((g) => ({
					id: g.id,
					name: g.name,
					monitors: g.monitors.map((m) => ({
						id: m.monitor.id,
						name: m.monitor.name,
						style: (m.style as "history" | "status") || "history",
						description: m.description,
					})),
				})),
			};
		}),

	updateStructure: writeProcedure
		.meta({
			openapi: {
				method: "PUT",
				path: "/status-pages/{id}/structure",
				tags: ["Status Page Management"],
				summary: "Update structure",
				description: "Update the layout structure of a status page.",
			},
		})
		.input(
			z.object({
				id: z.string(),
				groups: z.array(
					z.object({
						id: z.string().optional(),
						name: z.string(),
						monitors: z.array(
							z.object({
								id: z.string(),
								style: z.enum(["history", "status"]).default("history"),
								description: z.string().optional().nullable(),
							}),
						),
					}),
				),
			}),
		)
		.handler(async ({ input, context }) => {
			const existing = await db.query.statusPage.findFirst({
				where: and(
					eq(statusPage.id, input.id),
					eq(
						statusPage.organizationId,
						context.session.session.activeOrganizationId!,
					),
				),
			});
			if (!existing) throw new ORPCError("NOT_FOUND");

			await db.transaction(async (tx) => {
				await tx
					.delete(statusPageGroup)
					.where(eq(statusPageGroup.statusPageId, input.id));
				await tx
					.delete(statusPageMonitor)
					.where(eq(statusPageMonitor.statusPageId, input.id));

				for (const [gIndex, group] of input.groups.entries()) {
					const groupId = crypto.randomUUID();
					await tx.insert(statusPageGroup).values({
						id: groupId,
						statusPageId: input.id,
						name: group.name,
						order: gIndex,
					});

					if (group.monitors.length > 0) {
						await tx.insert(statusPageMonitor).values(
							group.monitors.map((m, mIndex) => ({
								statusPageId: input.id,
								monitorId: m.id,
								groupId: groupId,
								order: mIndex,
								style: m.style,
								description: m.description || null,
							})),
						);
					}
				}
			});

			// Invalidate cache
			if (existing.domain) {
				await redis.del(`status-page:${existing.domain}`);
			}

			return { success: true };
		}),

	delete: writeProcedure
		.meta({
			openapi: {
				method: "DELETE",
				path: "/status-pages/{id}",
				tags: ["Status Page Management"],
				summary: "Delete status page",
				description: "Delete a specific status page by ID.",
			},
		})
		.input(z.object({ id: z.string() }))
		.handler(async ({ input, context }) => {
			const existing = await db.query.statusPage.findFirst({
				where: and(
					eq(statusPage.id, input.id),
					eq(
						statusPage.organizationId,
						context.session.session.activeOrganizationId!,
					),
				),
			});

			if (!existing) {
				throw new ORPCError("NOT_FOUND", { message: "Status page not found" });
			}

			await db.delete(statusPage).where(eq(statusPage.id, input.id));

			// Invalidate cache
			if (existing.domain) {
				await redis.del(`status-page:${existing.domain}`);
			}

			return { success: true };
		}),
};
