import { afterEach, describe, expect, it, vi } from "vitest";
import {
	getExternalMonitorStatus,
	isExternalMonitor,
	isExternalMonitorType,
	mapExternalComponentStatus,
} from "./external-status";

const dnsLookupMock = vi.hoisted(() => vi.fn());

vi.mock("node:dns/promises", () => ({
	default: {
		lookup: dnsLookupMock,
	},
}));

afterEach(() => {
	dnsLookupMock.mockReset();
	vi.unstubAllGlobals();
});

describe("external status helpers", () => {
	it("recognizes configured external monitor types", () => {
		expect(isExternalMonitorType("instatus")).toBe(true);
		expect(isExternalMonitorType("http")).toBe(false);
		expect(
			isExternalMonitor({ type: "custom", config: { componentId: "id" } }),
		).toBe(true);
	});

	it("maps upstream component statuses to status page statuses", () => {
		expect(mapExternalComponentStatus("OPERATIONAL")).toBe("operational");
		expect(mapExternalComponentStatus("UNDERMAINTENANCE")).toBe("maintenance");
		expect(mapExternalComponentStatus("DEGRADED_PERFORMANCE")).toBe("degraded");
		expect(mapExternalComponentStatus("PARTIAL_OUTAGE")).toBe("partial_outage");
		expect(mapExternalComponentStatus("MAJOR_OUTAGE")).toBe("major_outage");
		expect(mapExternalComponentStatus("something-new")).toBe("unknown");
	});

	it("matches components by id before falling back to duplicate-prone names", async () => {
		dnsLookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);

		const fetchMock = vi.fn(async () => {
			return new Response(
				JSON.stringify({
					components: [
						{
							id: "london-compute",
							name: "London",
							status: "OPERATIONAL",
						},
						{
							id: "london-baremetal",
							name: "London",
							status: "UNDERMAINTENANCE",
						},
					],
				}),
				{ status: 200 },
			);
		});

		vi.stubGlobal("fetch", fetchMock);

		await expect(
			getExternalMonitorStatus({
				type: "instatus",
				config: {
					url: "https://status.example.com/",
					componentId: "london-baremetal",
					hostname: "London",
				},
			}),
		).resolves.toBe("maintenance");
		expect(fetchMock).toHaveBeenCalledWith(
			"https://status.example.com/v3/components.json",
			{ next: { revalidate: 60 }, redirect: "error" },
		);
	});

	it("returns unknown without a valid status page URL", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("{}", { status: 200 })),
		);

		await expect(
			getExternalMonitorStatus({
				type: "instatus",
				config: {
					componentId: "london-baremetal",
					hostname: "London",
				},
			}),
		).resolves.toBe("unknown");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("does not fetch unsafe saved status page URLs", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("{}", { status: 200 })),
		);

		await expect(
			getExternalMonitorStatus({
				type: "instatus",
				config: {
					url: "http://169.254.169.254/latest/meta-data",
					componentId: "london-baremetal",
				},
			}),
		).resolves.toBe("unknown");
		expect(fetch).not.toHaveBeenCalled();
		expect(dnsLookupMock).not.toHaveBeenCalled();
	});
});
