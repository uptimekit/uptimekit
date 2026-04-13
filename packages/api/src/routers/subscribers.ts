import { ORPCError } from "@orpc/server";
import { db } from "@uptimekit/db";
import { statusPageEmailSubscribers } from "@uptimekit/db/schema/status-updates";
import { statusPage } from "@uptimekit/db/schema/status-pages";
import { and, desc, eq, ilike } from "drizzle-orm";
import z from "zod";
import { protectedProcedure } from "..";

function getActiveOrganizationId(
	activeOrganizationId: string | null | undefined,
) {
	if (!activeOrganizationId) {
		throw new ORPCError("UNAUTHORIZED", {
			message: "No active organization",
		});
	}

	return activeOrganizationId;
}

export const subscribersRouter = {
	get: protectedProcedure
		.input(
			z.object({
				statusPageId: z.string(),
				q: z.string().optional(),
				limit: z.number().default(50),
				offset: z.number().default(0),
			}),
		)
		.handler(async ({ input, context }) => {
			const page = await db.query.statusPage.findFirst({
				where: and(
					eq(statusPage.id, input.statusPageId),
					eq(
						statusPage.organizationId,
						getActiveOrganizationId(
							context.session.session.activeOrganizationId,
						),
					),
				),
			});

			if (!page) {
				throw new ORPCError("NOT_FOUND", {
					message: "Status page not found",
				});
			}

			const filters = [
				eq(statusPageEmailSubscribers.statusPageId, input.statusPageId),
			];

			if (input.q) {
				filters.push(ilike(statusPageEmailSubscribers.email, `%${input.q}%`));
			}

			const whereClause = and(...filters);

			const [items, total] = await Promise.all([
				db
					.select()
					.from(statusPageEmailSubscribers)
					.where(whereClause)
					.orderBy(desc(statusPageEmailSubscribers.createdAt))
					.limit(input.limit)
					.offset(input.offset),
				db.$count(statusPageEmailSubscribers, whereClause),
			]);

			return {
				items,
				total,
			};
		}),
};
