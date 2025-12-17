import { ORPCError } from "@orpc/server";
import { db } from "@uptimekit/db";
import { statusPage } from "@uptimekit/db/schema/status-pages";
import {
	statusPageReport,
	statusPageReportMonitor,
	statusPageReportUpdate,
} from "@uptimekit/db/schema/status-updates";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../index";

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

	get: protectedProcedure
		.input(
			z.object({
				statusPageId: z.string(),
				reportId: z.string(),
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

			const report = await db.query.statusPageReport.findFirst({
				where: and(
					eq(statusPageReport.id, input.reportId),
					eq(statusPageReport.statusPageId, input.statusPageId),
				),
				with: {
					updates: {
						orderBy: [desc(statusPageReportUpdate.createdAt)],
					},
					affectedMonitors: true,
				},
			});

			if (!report) {
				throw new ORPCError("NOT_FOUND", { message: "Report not found" });
			}

			return report;
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
				monitors: z
					.array(
						z.object({
							id: z.string(),
							status: z.string(),
						}),
					)
					.default([]),
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

				if (input.monitors.length > 0) {
					await tx.insert(statusPageReportMonitor).values(
						input.monitors.map((m) => ({
							reportId,
							monitorId: m.id,
							status: m.status,
						})),
					);
				}
			});

			return { id: reportId };
		}),

	addUpdate: protectedProcedure
		.input(
			z.object({
				statusPageId: z.string(),
				reportId: z.string(),
				message: z.string().min(1),
				status: z.enum([
					"investigating",
					"identified",
					"monitoring",
					"resolved",
				]),
				monitors: z
					.array(
						z.object({
							id: z.string(),
							status: z.string(),
						}),
					)
					.default([]),
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

			const report = await db.query.statusPageReport.findFirst({
				where: and(
					eq(statusPageReport.id, input.reportId),
					eq(statusPageReport.statusPageId, input.statusPageId),
				),
			});

			if (!report) {
				throw new ORPCError("NOT_FOUND", { message: "Report not found" });
			}

			const now = new Date();

			await db.transaction(async (tx) => {
				// 1. Create the new update record
				await tx.insert(statusPageReportUpdate).values({
					id: crypto.randomUUID(),
					reportId: input.reportId,
					message: input.message,
					status: input.status,
					createdAt: now,
					userId: context.session.user.id,
				});

				// 2. Update the parent report status
				await tx
					.update(statusPageReport)
					.set({
						status: input.status,
						updatedAt: now,
						resolvedAt: input.status === "resolved" ? now : null,
					})
					.where(eq(statusPageReport.id, input.reportId));

				// 3. Update monitor statuses (delete existing for this report and re-insert to handle changes/removals easier, or just upsert)
				// For simplicity and correctness with the UI "which monitors are affected", we can delete all for this report and re-insert.
				// However, if we want to keep history of *which monitors were affected originally*, deleting might be bad if we want to show "Affected Services" on the public page.
				// Based on the UI, it seems we are defining "Current Affected Services".
				// So if I resolve a service, I might want to keep it in the list but mark it as Resolved.
				// Users will send the full list of currently affected services and their statuses.
				if (input.monitors.length > 0) {
					// We will upsert or simple delete-insert for this report ID to ensure `status` is updated.
					// Let's delete current mappings and re-insert to be safe and simple.
					await tx
						.delete(statusPageReportMonitor)
						.where(eq(statusPageReportMonitor.reportId, input.reportId));

					await tx.insert(statusPageReportMonitor).values(
						input.monitors.map((m) => ({
							reportId: input.reportId,
							monitorId: m.id,
							status: m.status,
						})),
					);
				}
			});

			return { success: true };
		}),

	editUpdate: protectedProcedure
		.input(
			z.object({
				statusPageId: z.string(),
				updateId: z.string(),
				message: z.string().min(1),
				status: z.enum([
					"investigating",
					"identified",
					"monitoring",
					"resolved",
				]),
				monitors: z
					.array(
						z.object({
							id: z.string(),
							status: z.string(),
						}),
					)
					.default([]),
			}),
		)
		.handler(async ({ input, context }) => {
			const activeOrganizationId = context.session.session.activeOrganizationId;

			if (!activeOrganizationId) {
				throw new ORPCError("UNAUTHORIZED", {
					message: "No active organization",
				});
			}

			// Verify ownership via status page lookup
			const page = await db.query.statusPage.findFirst({
				where: and(
					eq(statusPage.id, input.statusPageId),
					eq(statusPage.organizationId, activeOrganizationId),
				),
			});

			if (!page) {
				throw new ORPCError("NOT_FOUND", { message: "Status page not found" });
			}

			const update = await db.query.statusPageReportUpdate.findFirst({
				where: eq(statusPageReportUpdate.id, input.updateId),
				with: {
					report: true,
				},
			});

			if (!update) {
				throw new ORPCError("NOT_FOUND", { message: "Update not found" });
			}

			if (update.report.statusPageId !== input.statusPageId) {
				throw new ORPCError("NOT_FOUND", {
					message: "Update does not belong to this status page",
				});
			}

			const now = new Date();

			await db.transaction(async (tx) => {
				// 1. Update the update record
				await tx
					.update(statusPageReportUpdate)
					.set({
						message: input.message,
						status: input.status,
					})
					.where(eq(statusPageReportUpdate.id, input.updateId));

				// 2. Update the parent report status
				await tx
					.update(statusPageReport)
					.set({
						status: input.status,
						updatedAt: now,
						resolvedAt: input.status === "resolved" ? now : null,
					})
					.where(eq(statusPageReport.id, update.reportId));

				// 3. Update monitor statuses
				await tx
					.delete(statusPageReportMonitor)
					.where(eq(statusPageReportMonitor.reportId, update.reportId));

				if (input.monitors.length > 0) {
					await tx.insert(statusPageReportMonitor).values(
						input.monitors.map((m) => ({
							reportId: update.reportId,
							monitorId: m.id,
							status: m.status,
						})),
					);
				}
			});

			return { success: true };
		}),
};
