import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ImportSourceRegistry } from "./registry";
import type { ImportSource } from "./types";

function makeSource(id: string): ImportSource {
    return {
        id,
        label: id,
        description: "",
        connectionSchema: z.object({}),
        fetch: async () => ({}),
        map: () => ({ monitors: [], groups: [], tags: [], skipped: [] }),
    };
}

describe("ImportSourceRegistry", () => {
    it("registers and retrieves a source by id", () => {
        const registry = new ImportSourceRegistry();
        const source = makeSource("uptime-kuma");
        registry.register(source);
        expect(registry.get("uptime-kuma")).toBe(source);
    });

    it("returns undefined for an unknown id", () => {
        const registry = new ImportSourceRegistry();
        expect(registry.get("nope")).toBeUndefined();
    });

    it("lists registered sources", () => {
        const registry = new ImportSourceRegistry();
        registry.register(makeSource("a"));
        registry.register(makeSource("b"));
        expect(registry.list().map((s) => s.id)).toEqual(["a", "b"]);
    });
});
