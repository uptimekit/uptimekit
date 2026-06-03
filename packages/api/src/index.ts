import { ORPCError, os } from "@orpc/server";
import { db } from "@uptimekit/db";
import { member } from "@uptimekit/db/schema/auth";
import { and, eq } from "drizzle-orm";
import { type EvlogOrpcContext, evlog as evlogProcedure } from "evlog/orpc";

export * from "./pkg/integrations/definitions/discord";
export * from "./pkg/integrations/definitions/webhook";
export * from "./pkg/integrations/registry";

import type { Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o.use(
	evlogProcedure<Context & Partial<EvlogOrpcContext>>(),
);

const requireAuth = o.middleware(async ({ context, next }) => {
	if (context.apiKey?.error === "invalid") {
		throw new ORPCError("UNAUTHORIZED", {
			message: "Invalid API key.",
		});
	}

	if (context.apiKey?.error === "not_member") {
		throw new ORPCError("FORBIDDEN", {
			message: "API key is not authorized for the requested organization.",
		});
	}

	if (!context.session?.user) {
		throw new ORPCError("UNAUTHORIZED");
	}

	return next({
		context: {
			...context,
			session: context.session,
		},
	});
});

export const protectedProcedure = publicProcedure.use(requireAuth);

export const writeProcedure = protectedProcedure.use(
	async ({ context, next }) => {
		const { session } = context.session;
		if (!session.activeOrganizationId) {
			throw new ORPCError("UNAUTHORIZED", {
				message: "No active organization",
			});
		}

		if (context.authType === "apiKey") {
			return next({ context });
		}

		const memberRecord = await db.query.member.findFirst({
			where: and(
				eq(member.userId, session.userId),
				eq(member.organizationId, session.activeOrganizationId),
			),
		});

		if (!memberRecord) {
			throw new ORPCError("UNAUTHORIZED", { message: "Member not found" });
		}

		if (memberRecord.role !== "owner" && memberRecord.role !== "admin") {
			throw new ORPCError("FORBIDDEN", {
				message: "You don't have permission to perform this action.",
			});
		}

		return next({ context });
	},
);

export const adminProcedure = protectedProcedure.use(
	async ({ context, next }) => {
		if (context.session.user.role !== "admin") {
			throw new ORPCError("FORBIDDEN", {
				message: "Admin access required",
			});
		}
		return next({ context });
	},
);
