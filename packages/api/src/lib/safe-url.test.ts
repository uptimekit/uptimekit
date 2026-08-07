import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    assertSafePublicHttpUrl,
    assertSafeWebhookUrl,
    fetchPublicHttpUrl,
} from "./safe-url";

const dnsLookupMock = vi.hoisted(() => vi.fn());

vi.mock("node:dns/promises", () => ({
    default: {
        lookup: dnsLookupMock,
    },
}));

describe("safe public URL validation", () => {
    beforeEach(() => {
        dnsLookupMock.mockReset();
    });

    it("rejects malformed URLs and unsupported protocols", async () => {
        await expect(
            assertSafePublicHttpUrl("not a URL", { label: "Target URL" }),
        ).rejects.toThrow("Target URL must be a valid URL");
        await expect(
            assertSafePublicHttpUrl("ftp://example.com", {
                label: "Target URL",
            }),
        ).rejects.toThrow("Target URL must use HTTP or HTTPS");
        expect(dnsLookupMock).not.toHaveBeenCalled();
    });

    it("rejects cloud metadata and localhost IP literals before DNS lookup", async () => {
        await expect(
            assertSafePublicHttpUrl("http://169.254.169.254/latest/meta-data", {
                label: "Status page URL",
            }),
        ).rejects.toThrow("Status page URL cannot target private IP addresses");
        await expect(
            assertSafeWebhookUrl("http://127.0.0.1:8080"),
        ).rejects.toThrow("Webhook URL cannot target private IP addresses");
        expect(dnsLookupMock).not.toHaveBeenCalled();
    });

    it("rejects non-public IP literal variants before DNS lookup", async () => {
        await expect(
            assertSafePublicHttpUrl("http://100.64.0.1"),
        ).rejects.toThrow("URL cannot target private IP addresses");
        await expect(
            assertSafePublicHttpUrl("http://[::ffff:127.0.0.1]"),
        ).rejects.toThrow("URL cannot target private IP addresses");
        await expect(
            assertSafePublicHttpUrl("http://[::7f00:1]"),
        ).rejects.toThrow("URL cannot target private IP addresses");
        expect(dnsLookupMock).not.toHaveBeenCalled();
    });

    it.each([
        "localhost",
        "service.localhost",
        "service.local",
        "service.internal",
    ])("rejects the internal hostname %s", async (hostname) => {
        await expect(
            assertSafePublicHttpUrl(`https://${hostname}`, {
                label: "Status page URL",
            }),
        ).rejects.toThrow("Status page URL cannot target internal hosts");
        expect(dnsLookupMock).not.toHaveBeenCalled();
    });

    it("rejects hostnames that resolve to private addresses", async () => {
        dnsLookupMock.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);

        await expect(
            assertSafePublicHttpUrl("https://status.example.com", {
                label: "Status page URL",
            }),
        ).rejects.toThrow(
            "Status page URL cannot resolve to a private IP address",
        );
    });

    it("rejects hostnames with any private DNS result", async () => {
        dnsLookupMock.mockResolvedValue([
            { address: "93.184.216.34", family: 4 },
            { address: "10.0.0.5", family: 4 },
        ]);

        await expect(
            assertSafePublicHttpUrl("https://status.example.com"),
        ).rejects.toThrow("URL cannot resolve to a private IP address");
    });

    it("rejects failed and empty DNS results", async () => {
        dnsLookupMock.mockRejectedValueOnce(new Error("DNS unavailable"));
        await expect(
            assertSafePublicHttpUrl("https://status.example.com"),
        ).rejects.toThrow("URL hostname could not be resolved");

        dnsLookupMock.mockResolvedValueOnce([]);
        await expect(
            assertSafePublicHttpUrl("https://status.example.com"),
        ).rejects.toThrow("URL hostname could not be resolved");
    });

    it("revalidates DNS while opening outbound HTTP connections", async () => {
        dnsLookupMock.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);

        await expect(
            fetchPublicHttpUrl("http://status.example.com/v3/components.json", {
                label: "Status page URL",
            }),
        ).rejects.toThrow(
            "Status page URL cannot resolve to a private IP address",
        );
        expect(dnsLookupMock).toHaveBeenCalledWith(
            "status.example.com",
            expect.objectContaining({ all: true, verbatim: true }),
        );
    });

    it("allows hostnames that resolve only to public addresses", async () => {
        dnsLookupMock.mockResolvedValue([
            { address: "93.184.216.34", family: 4 },
        ]);

        await expect(
            assertSafePublicHttpUrl("https://status.example.com", {
                label: "Status page URL",
            }),
        ).resolves.toBeUndefined();
    });

    it.each(["http://93.184.216.34", "https://[2606:4700:4700::1111]"])(
        "allows the public IP literal %s without DNS",
        async (url) => {
            await expect(assertSafePublicHttpUrl(url)).resolves.toBeUndefined();
            expect(dnsLookupMock).not.toHaveBeenCalled();
        },
    );
});
