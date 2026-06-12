import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertSafePublicHttpUrl, assertSafeWebhookUrl } from "./safe-url";

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

	it("rejects cloud metadata and localhost IP literals before DNS lookup", async () => {
		await expect(
			assertSafePublicHttpUrl("http://169.254.169.254/latest/meta-data", {
				label: "Status page URL",
			}),
		).rejects.toThrow("Status page URL cannot target private IP addresses");
		await expect(assertSafeWebhookUrl("http://127.0.0.1:8080")).rejects.toThrow(
			"Webhook URL cannot target private IP addresses",
		);
		expect(dnsLookupMock).not.toHaveBeenCalled();
	});

	it("rejects internal hostnames", async () => {
		await expect(
			assertSafePublicHttpUrl("https://service.internal", {
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
		).rejects.toThrow("Status page URL cannot resolve to a private IP address");
	});

	it("allows hostnames that resolve only to public addresses", async () => {
		dnsLookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);

		await expect(
			assertSafePublicHttpUrl("https://status.example.com", {
				label: "Status page URL",
			}),
		).resolves.toBeUndefined();
	});
});
