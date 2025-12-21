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
import {
	hasActiveSubscription,
	isSelfHosted,
	MAX_STATUS_PAGES,
} from "../lib/limits";

export const statusPagesRouter = {
	list: protectedProcedure
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
		.input(
			z.object({
				name: z.string().min(1),
				slug: z.string().min(1),
				isPrivate: z.boolean().default(false),
			}),
		)
		.handler(async ({ input, context }) => {
			if (!isSelfHosted()) {
				const hasSub = await hasActiveSubscription(
					context.session.session.activeOrganizationId!,
					context.headers,
				);

				if (!hasSub) {
					const currentCount = await db.$count(
						statusPage,
						eq(
							statusPage.organizationId,
							context.session.session.activeOrganizationId!,
						),
					);

					if (currentCount >= MAX_STATUS_PAGES) {
						throw new ORPCError("FORBIDDEN", {
							message: `Plan limit reached. You can only create up to ${MAX_STATUS_PAGES} status page.`,
						});
					}
				}
			}

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
		.input(
			z.object({
				id: z.string(),
				name: z.string().optional(),
				slug: z.string().optional(),
				domain: z.string().optional().nullable(),
				websiteUrl: z.string().optional().nullable(), // Will need to add to schema if not present, map to description or new field?
				// Checking schema: domain, description, design (json), public, password.
				// Screenshot had: Logo URL, Website URL, Contact URL. These likely go into `design` JSON or new columns.
				// For now, I'll store them in `design` json if schema doesn't have columns.
				// Schema has `design: json("design")`.
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

			return { success: true };
		}),

	// Structure management
	getStructure: protectedProcedure
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
					})),
				})),
			};
		}),

	updateStructure: writeProcedure
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
							})),
						);
					}
				}
			});

			return { success: true };
		}),
};
