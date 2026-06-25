export type AdminUserAction = "ban" | "delete" | "demote";

interface AdminUserActionCheck {
    action: AdminUserAction;
    adminCount: number;
    currentUserId: string;
    targetRole: string | null | undefined;
    targetUserId: string;
}

export function isInstanceAdminRole(role: string | null | undefined) {
    return (
        role
            ?.split(",")
            .map((value) => value.trim())
            .includes("admin") ?? false
    );
}

export function getAdminUserActionError({
    action,
    adminCount,
    currentUserId,
    targetRole,
    targetUserId,
}: AdminUserActionCheck) {
    if (targetUserId === currentUserId) {
        if (action === "ban") {
            return "You cannot ban your own account.";
        }

        if (action === "delete") {
            return "You cannot delete your own account.";
        }

        return "You cannot remove your own admin role.";
    }

    if (isInstanceAdminRole(targetRole) && adminCount <= 1) {
        return "At least one admin must remain.";
    }

    return null;
}
