import { ORPCError } from "@orpc/server";
import { auth } from "@uptimekit/auth";
import { db } from "@uptimekit/db";
import { session as authSession, user } from "@uptimekit/db/schema/auth";
import { incident, incidentActivity } from "@uptimekit/db/schema/incidents";
import { statusPageReportUpdate } from "@uptimekit/db/schema/status-updates";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure } from "../index";
import {
    getAdminUserActionError,
    isInstanceAdminRole,
} from "../lib/admin-users";

function adminRoleCondition() {
    return or(
        eq(user.role, "admin"),
        sql`${user.role} LIKE 'admin,%'`,
        sql`${user.role} LIKE '%,admin'`,
        sql`${user.role} LIKE '%,admin,%'`,
    );
}

async function getAdminCount() {
    const [result] = await db
        .select({ count: count() })
        .from(user)
        .where(adminRoleCondition());

    return result?.count || 0;
}

async function getUserOrThrow(id: string) {
    const [targetUser] = await db
        .select()
        .from(user)
        .where(eq(user.id, id))
        .limit(1);

    if (!targetUser) {
        throw new ORPCError("NOT_FOUND", { message: "User not found" });
    }

    return targetUser;
}

async function assertAdminActionAllowed({
    action,
    currentUserId,
    targetRole,
    targetUserId,
}: {
    action: "ban" | "delete" | "demote";
    currentUserId: string;
    targetRole: string | null | undefined;
    targetUserId: string;
}) {
    const error = getAdminUserActionError({
        action,
        adminCount: await getAdminCount(),
        currentUserId,
        targetRole,
        targetUserId,
    });

    if (error) {
        throw new ORPCError("BAD_REQUEST", { message: error });
    }
}

export const usersRouter = {
    list: adminProcedure
        .route({
            method: "GET",
            path: "/admin/users",
            tags: ["Admin - Users"],
            summary: "List all users",
            description:
                "List all registered users with search and filters. Admin only.",
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
                filters.push(adminRoleCondition());
            } else if (input?.role === "user") {
                filters.push(
                    or(eq(user.role, "user"), sql`${user.role} IS NULL`),
                );
            }

            if (input?.status === "banned") {
                filters.push(eq(user.banned, true));
            } else if (input?.status === "active") {
                filters.push(
                    or(eq(user.banned, false), sql`${user.banned} IS NULL`),
                );
            }

            const whereClause =
                filters.length > 0 ? and(...filters) : undefined;

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
        .route({
            method: "POST",
            path: "/admin/users",
            tags: ["Admin - Users"],
            summary: "Create a user",
            description:
                "Create a new user with email and password. Admin only.",
        })
        .input(
            z.object({
                name: z.string().trim().min(1),
                email: z.string().trim().email(),
                password: z.string().min(8),
                role: z.enum(["admin", "user"]).default("user"),
            }),
        )
        .handler(async ({ input }) => {
            const created = await auth.api.createUser({
                body: {
                    email: input.email.toLowerCase(),
                    password: input.password,
                    name: input.name,
                    role: input.role,
                },
            });
            return created;
        }),

    update: adminProcedure
        .route({
            method: "PUT",
            path: "/admin/users/{id}",
            tags: ["Admin - Users"],
            summary: "Update a user",
            description:
                "Update profile fields, access, ban status, or password. Admin only.",
        })
        .input(
            z.object({
                id: z.string(),
                name: z.string().trim().min(1).optional(),
                email: z.string().trim().email().optional(),
                image: z.string().trim().nullable().optional(),
                role: z.enum(["admin", "user"]).optional(),
                banned: z.boolean().optional(),
                banReason: z.string().trim().nullable().optional(),
                banExpires: z.string().datetime().nullable().optional(),
                newPassword: z.string().min(8).optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const targetUser = await getUserOrThrow(input.id);

            if (input.role === "user" && isInstanceAdminRole(targetUser.role)) {
                await assertAdminActionAllowed({
                    action: "demote",
                    currentUserId: context.session.user.id,
                    targetRole: targetUser.role,
                    targetUserId: targetUser.id,
                });
            }

            if (input.banned === true && targetUser.banned !== true) {
                await assertAdminActionAllowed({
                    action: "ban",
                    currentUserId: context.session.user.id,
                    targetRole: targetUser.role,
                    targetUserId: targetUser.id,
                });
            }

            if (input.email) {
                const normalizedEmail = input.email.toLowerCase();
                const [existingUser] = await db
                    .select({ id: user.id })
                    .from(user)
                    .where(eq(user.email, normalizedEmail))
                    .limit(1);

                if (existingUser && existingUser.id !== input.id) {
                    throw new ORPCError("CONFLICT", {
                        message: "A user with this email already exists.",
                    });
                }
            }

            const updateData: Partial<typeof user.$inferInsert> = {};

            if (input.name !== undefined) {
                updateData.name = input.name;
            }

            if (input.email !== undefined) {
                updateData.email = input.email.toLowerCase();
            }

            if (input.image !== undefined) {
                updateData.image = input.image || null;
            }

            if (input.role !== undefined) {
                updateData.role = input.role === "admin" ? "admin" : null;
            }

            if (input.banned !== undefined) {
                updateData.banned = input.banned;
                updateData.banReason = input.banned
                    ? input.banReason || null
                    : null;
                updateData.banExpires =
                    input.banned && input.banExpires
                        ? new Date(input.banExpires)
                        : null;
            }

            if (Object.keys(updateData).length === 0 && !input.newPassword) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "No user changes were provided.",
                });
            }

            let updated = targetUser;

            if (Object.keys(updateData).length > 0) {
                const [updatedUser] = await db
                    .update(user)
                    .set(updateData)
                    .where(eq(user.id, input.id))
                    .returning();

                if (!updatedUser) {
                    throw new ORPCError("NOT_FOUND", {
                        message: "User not found",
                    });
                }

                updated = updatedUser;
            }

            const targetRole = isInstanceAdminRole(targetUser.role)
                ? "admin"
                : "user";
            const roleChanged =
                input.role !== undefined && input.role !== targetRole;
            const newlyBanned =
                input.banned === true && targetUser.banned !== true;

            if (roleChanged || newlyBanned) {
                await db
                    .delete(authSession)
                    .where(eq(authSession.userId, input.id));
            }

            if (input.newPassword) {
                await auth.api.setUserPassword({
                    body: {
                        newPassword: input.newPassword,
                        userId: input.id,
                    },
                    headers: context.headers as Headers,
                });
            }

            return updated;
        }),

    ban: adminProcedure
        .route({
            method: "POST",
            path: "/admin/users/{id}/ban",
            tags: ["Admin - Users"],
            summary: "Ban a user",
            description:
                "Ban a user with optional reason and expiration. Admin only.",
        })
        .input(
            z.object({
                id: z.string(),
                reason: z.string().optional(),
                expiresAt: z.string().datetime().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const targetUser = await getUserOrThrow(input.id);
            await assertAdminActionAllowed({
                action: "ban",
                currentUserId: context.session.user.id,
                targetRole: targetUser.role,
                targetUserId: targetUser.id,
            });

            const [updated] = await db
                .update(user)
                .set({
                    banned: true,
                    banReason: input.reason || null,
                    banExpires: input.expiresAt
                        ? new Date(input.expiresAt)
                        : null,
                })
                .where(eq(user.id, input.id))
                .returning();

            await db
                .delete(authSession)
                .where(eq(authSession.userId, input.id));

            return updated;
        }),

    unban: adminProcedure
        .route({
            method: "POST",
            path: "/admin/users/{id}/unban",
            tags: ["Admin - Users"],
            summary: "Unban a user",
            description: "Remove ban from a user. Admin only.",
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
        .route({
            method: "POST",
            path: "/admin/users/{id}/role",
            tags: ["Admin - Users"],
            summary: "Set user role",
            description:
                "Update user role (admin or regular user). Admin only.",
        })
        .input(
            z.object({
                id: z.string(),
                role: z.enum(["admin", "user"]),
            }),
        )
        .handler(async ({ context, input }) => {
            const targetUser = await getUserOrThrow(input.id);

            if (input.role === "user" && isInstanceAdminRole(targetUser.role)) {
                await assertAdminActionAllowed({
                    action: "demote",
                    currentUserId: context.session.user.id,
                    targetRole: targetUser.role,
                    targetUserId: targetUser.id,
                });
            }

            const [updated] = await db
                .update(user)
                .set({
                    role: input.role === "user" ? null : input.role,
                })
                .where(eq(user.id, input.id))
                .returning();

            await db
                .delete(authSession)
                .where(eq(authSession.userId, input.id));

            return updated;
        }),

    delete: adminProcedure
        .route({
            method: "DELETE",
            path: "/admin/users/{id}",
            tags: ["Admin - Users"],
            summary: "Delete a user",
            description:
                "Hard-delete a user account while preserving historical records. Admin only.",
        })
        .input(z.object({ id: z.string() }))
        .handler(async ({ context, input }) => {
            const targetUser = await getUserOrThrow(input.id);

            await assertAdminActionAllowed({
                action: "delete",
                currentUserId: context.session.user.id,
                targetRole: targetUser.role,
                targetUserId: targetUser.id,
            });

            await db.transaction(async (tx) => {
                await tx
                    .update(incident)
                    .set({ acknowledgedBy: null })
                    .where(eq(incident.acknowledgedBy, input.id));
                await tx
                    .update(incidentActivity)
                    .set({ userId: null })
                    .where(eq(incidentActivity.userId, input.id));
                await tx
                    .update(statusPageReportUpdate)
                    .set({ userId: null })
                    .where(eq(statusPageReportUpdate.userId, input.id));
                await tx.delete(user).where(eq(user.id, input.id));
            });

            return { success: true };
        }),
};
