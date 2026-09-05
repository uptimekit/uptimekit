import { describe, expect, it } from "vitest";
import type { Context } from "../context";
import { getAuditUserId } from "./audit-user";

describe("audit user attribution", () => {
    const session = { user: { id: "user-1" } } as Context["session"];

    it("attributes browser actions to the real user", () => {
        expect(getAuditUserId({ authType: "session", session })).toBe("user-1");
    });

    it("does not attribute organization key actions to a browser user or synthetic user", () => {
        for (const id of ["user-1", "api-key:key-1"]) {
            expect(
                getAuditUserId({
                    authType: "apiKey",
                    session: { user: { id } } as Context["session"],
                }),
            ).toBeNull();
        }
    });
});
