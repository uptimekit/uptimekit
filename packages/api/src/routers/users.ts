import { auth } from "@uptimekit/auth";
import { db } from "@uptimekit/db";
import { user } from "@uptimekit/db/schema/auth";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure } from "../index";

export const usersRouter = {
	list: adminProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/admin/users",
				tags: ["Admin - Users"],
				summary: "List all users",
				description:
					"List all registered users with search and filters. Admin only.",
			},
		})
		.input(
			z
				.object({
					q: z.string().optional(),
					role: z.enum(["all", "admin", "user"]).default("all"),
					status: z.enum(["all", "active", "banned"]).default("all"),
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
						ilike(user.name, `%${input.q}%`),
						ilike(user.email, `%${input.q}%`),
					),
				);
			}

			if (input?.role === "admin") {
				filters.push(eq(user.role, "admin"));
			} else if (input?.role === "user") {
				filters.push(or(eq(user.role, "user"), sql`${user.role} IS NULL`));
			}

			if (input?.status === "banned") {
				filters.push(eq(user.banned, true));
			} else if (input?.status === "active") {
				filters.push(or(eq(user.banned, false), sql`${user.banned} IS NULL`));
			}

			const whereClause = filters.length > 0 ? and(...filters) : undefined;

			const [items, [totalResult]] = await Promise.all([
				db
					.select({
						id: user.id,
						name: user.name,
						email: user.email,
						image: user.image,
						role: user.role,
						banned: user.banned,
						banReason: user.banReason,
						banExpires: user.banExpires,
						createdAt: user.createdAt,
					})
					.from(user)
					.where(whereClause)
					.orderBy(desc(user.createdAt))
					.limit(input?.limit || 50)
					.offset(input?.offset || 0),
				db.select({ count: count() }).from(user).where(whereClause),
			]);

			return { items, total: totalResult?.count || 0 };
		}),

	create: adminProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/admin/users",
				tags: ["Admin - Users"],
				summary: "Create a user",
				description: "Create a new user with email and password. Admin only.",
			},
		})
		.input(
			z.object({
				name: z.string().min(1),
				email: z.string().email(),
				password: z.string().min(8),
			}),
		)
		.handler(async ({ input }) => {
			const created = await auth.api.createUser({
				body: {
					email: input.email,
					password: input.password,
					name: input.name,
				},
			});
			return created;
		}),

	ban: adminProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/admin/users/{id}/ban",
				tags: ["Admin - Users"],
				summary: "Ban a user",
				description:
					"Ban a user with optional reason and expiration. Admin only.",
			},
		})
		.input(
			z.object({
				id: z.string(),
				reason: z.string().optional(),
				expiresAt: z.string().datetime().optional(),
			}),
		)
		.handler(async ({ input }) => {
			const [updated] = await db
				.update(user)
				.set({
					banned: true,
					banReason: input.reason || null,
					banExpires: input.expiresAt ? new Date(input.expiresAt) : null,
				})
				.where(eq(user.id, input.id))
				.returning();

			return updated;
		}),

	unban: adminProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/admin/users/{id}/unban",
				tags: ["Admin - Users"],
				summary: "Unban a user",
				description: "Remove ban from a user. Admin only.",
			},
		})
		.input(z.object({ id: z.string() }))
		.handler(async ({ input }) => {
			const [updated] = await db
				.update(user)
				.set({
					banned: false,
					banReason: null,
					banExpires: null,
				})
				.where(eq(user.id, input.id))
				.returning();

			return updated;
		}),

	setRole: adminProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/admin/users/{id}/role",
				tags: ["Admin - Users"],
				summary: "Set user role",
				description: "Update user role (admin or regular user). Admin only.",
			},
		})
		.input(
			z.object({
				id: z.string(),
				role: z.enum(["admin", "user"]),
			}),
		)
		.handler(async ({ input }) => {
			const [updated] = await db
				.update(user)
				.set({
					role: input.role === "user" ? null : input.role,
				})
				.where(eq(user.id, input.id))
				.returning();

			return updated;
		}),
};
