import { describe, expect, it } from "vitest";
import {
    getAdminUserActionError,
    isInstanceAdminRole,
} from "../lib/admin-users";

describe("admin user safeguards", () => {
    it("detects comma-separated admin roles", () => {
        expect(isInstanceAdminRole("admin")).toBe(true);
        expect(isInstanceAdminRole("user,admin")).toBe(true);
        expect(isInstanceAdminRole("user")).toBe(false);
        expect(isInstanceAdminRole(null)).toBe(false);
    });

    it("prevents self-destructive admin actions", () => {
        expect(
            getAdminUserActionError({
                action: "delete",
                adminCount: 2,
                currentUserId: "user-1",
                targetRole: "admin",
                targetUserId: "user-1",
            }),
        ).toBe("You cannot delete your own account.");

        expect(
            getAdminUserActionError({
                action: "demote",
                adminCount: 2,
                currentUserId: "user-1",
                targetRole: "admin",
                targetUserId: "user-1",
            }),
        ).toBe("You cannot remove your own admin role.");
    });

    it("prevents removing the last admin", () => {
        expect(
            getAdminUserActionError({
                action: "ban",
                adminCount: 1,
                currentUserId: "admin-1",
                targetRole: "admin",
                targetUserId: "admin-2",
            }),
        ).toBe("At least one admin must remain.");
    });

    it("allows actions against non-admin users", () => {
        expect(
            getAdminUserActionError({
                action: "delete",
                adminCount: 1,
                currentUserId: "admin-1",
                targetRole: "user",
                targetUserId: "user-1",
            }),
        ).toBeNull();
    });
});
