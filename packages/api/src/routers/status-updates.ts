import { db } from "@uptimekit/db";
import {
	statusPageReport,
	statusPageReportUpdate,
} from "@uptimekit/db/schema/status-updates";
import { statusPage } from "@uptimekit/db/schema/status-pages";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../index";
import { ORPCError } from "@orpc/server";

export const statusUpdatesRouter = {
	list: protectedProcedure
		.input(
			z.object({
				statusPageId: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const activeOrganizationId = context.session.session.activeOrganizationId;

			if (!activeOrganizationId) {
				throw new ORPCError("UNAUTHORIZED", {
					message: "No active organization",
				});
			}

			// Verify ownership of the status page
			const page = await db.query.statusPage.findFirst({
				where: and(
					eq(statusPage.id, input.statusPageId),
					eq(statusPage.organizationId, activeOrganizationId),
				),
			});

			if (!page) {
				throw new ORPCError("NOT_FOUND", { message: "Status page not found" });
			}

			const reports = await db.query.statusPageReport.findMany({
				where: eq(statusPageReport.statusPageId, input.statusPageId),
				orderBy: [desc(statusPageReport.createdAt)],
				with: {
					updates: {
						orderBy: [desc(statusPageReportUpdate.createdAt)],
					},
					affectedMonitors: true,
				},
			});

			return reports;
		}),

	create: protectedProcedure
		.input(
			z.object({
				statusPageId: z.string(),
				title: z.string().min(1),
				status: z.enum([
					"investigating",
					"identified",
					"monitoring",
					"resolved",
				]),
				severity: z.enum(["minor", "major", "critical", "maintenance"]),
				message: z.string().min(1), // First update message
			}),
		)
		.handler(async ({ input, context }) => {
			const activeOrganizationId = context.session.session.activeOrganizationId;

			if (!activeOrganizationId) {
				throw new ORPCError("UNAUTHORIZED", {
					message: "No active organization",
				});
			}

			const page = await db.query.statusPage.findFirst({
				where: and(
					eq(statusPage.id, input.statusPageId),
					eq(statusPage.organizationId, activeOrganizationId),
				),
			});

			if (!page) {
				throw new ORPCError("NOT_FOUND", { message: "Status page not found" });
			}

			const reportId = crypto.randomUUID();
			const now = new Date();

			await db.transaction(async (tx) => {
				await tx.insert(statusPageReport).values({
					id: reportId,
					statusPageId: input.statusPageId,
					title: input.title,
					status: input.status,
					severity: input.severity,
					createdAt: now,
					updatedAt: now,
					resolvedAt: input.status === "resolved" ? now : null,
				});

				await tx.insert(statusPageReportUpdate).values({
					id: crypto.randomUUID(),
					reportId: reportId,
					message: input.message,
					status: input.status,
					createdAt: now,
					userId: context.session.user.id,
				});
			});

			return { id: reportId };
		}),
};
