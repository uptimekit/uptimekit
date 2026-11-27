import { describe, expect, it } from "vitest";
import { parseNavLinks } from "./look";

describe("parseNavLinks", () => {
    it("reads one label | url per line", () => {
        expect(
            parseNavLinks(
                "docs | https://docs.example.com\n blog|http://blog.example.com ",
            ),
        ).toEqual([
            { label: "docs", url: "https://docs.example.com" },
            { label: "blog", url: "http://blog.example.com" },
        ]);
    });

    it("drops lines that are not http(s) links", () => {
        expect(
            parseNavLinks(
                [
                    "xss | javascript:alert(1)",
                    "data | data:text/html,hi",
                    "no url |",
                    "| https://no-label.example.com",
                    "no pipe https://example.com",
                    "relative | /status",
                ].join("\n"),
            ),
        ).toEqual([]);
    });

    it("keeps at most six links", () => {
        const raw = Array.from(
            { length: 8 },
            (_, i) => `l${i} | https://e.com/${i}`,
        ).join("\n");
        expect(parseNavLinks(raw)).toHaveLength(6);
    });
});
