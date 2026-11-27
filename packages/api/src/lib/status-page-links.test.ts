import { describe, expect, it } from "vitest";
import { normalizeLinkedStatusPageIds } from "./status-page-links";

describe("normalizeLinkedStatusPageIds", () => {
    it("dedupes, keeps order and drops the page itself", () => {
        expect(
            normalizeLinkedStatusPageIds(["b", "self", "a", "b"], "self"),
        ).toEqual(["b", "a"]);
    });
});
