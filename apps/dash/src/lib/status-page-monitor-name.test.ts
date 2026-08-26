import { describe, expect, it } from "vitest";
import {
    hasMonitorDisplayNameOverride,
    normalizeMonitorDisplayName,
    resolveMonitorDisplayName,
} from "./status-page-monitor-name";

describe("resolveMonitorDisplayName", () => {
    it("prefers the per-page override", () => {
        expect(
            resolveMonitorDisplayName({
                name: "Checkout API",
                displayName: "Payments",
            }),
        ).toBe("Payments");
    });

    it("trims the override", () => {
        expect(
            resolveMonitorDisplayName({
                name: "Checkout API",
                displayName: "  Payments  ",
            }),
        ).toBe("Payments");
    });

    it.each([
        ["undefined", undefined],
        ["null", null],
        ["empty", ""],
        ["whitespace only", "   "],
    ])(
        "falls back to the real name when the override is %s",
        (_label, value) => {
            expect(
                resolveMonitorDisplayName({
                    name: "Checkout API",
                    displayName: value,
                }),
            ).toBe("Checkout API");
        },
    );
});

describe("hasMonitorDisplayNameOverride", () => {
    it("reports an override that changes the label", () => {
        expect(
            hasMonitorDisplayNameOverride({
                name: "Checkout API",
                displayName: "Payments",
            }),
        ).toBe(true);
    });

    it("ignores an override equal to the real name", () => {
        expect(
            hasMonitorDisplayNameOverride({
                name: "Checkout API",
                displayName: "  Checkout API  ",
            }),
        ).toBe(false);
    });

    it("reports no override when none is set", () => {
        expect(
            hasMonitorDisplayNameOverride({
                name: "Checkout API",
                displayName: null,
            }),
        ).toBe(false);
    });
});

describe("normalizeMonitorDisplayName", () => {
    it("trims a real override", () => {
        expect(normalizeMonitorDisplayName("  Payments ")).toBe("Payments");
    });

    it.each([
        ["undefined", undefined],
        ["null", null],
        ["empty", ""],
        ["whitespace only", "   "],
    ])("stores %s as null", (_label, value) => {
        expect(normalizeMonitorDisplayName(value)).toBeNull();
    });
});
