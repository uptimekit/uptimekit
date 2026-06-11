import { describe, expect, it } from "vitest";
import type { Monitor, StatusType } from "@/themes/types";
import { getSectionStatus, getSectionStatusText } from "./section-status";

function monitor(status: StatusType): Monitor {
	return {
		id: crypto.randomUUID(),
		name: "API",
		currentStatus: status,
		avgUptime: 100,
		history: [],
		displayStyle: "history",
	};
}

describe("section status", () => {
	it("summarizes fully operational sections", () => {
		const status = getSectionStatus([
			monitor("operational"),
			monitor("operational"),
		]);

		expect(status).toBe("operational");
		expect(getSectionStatusText(status, 2)).toBe("All services are online");
	});

	it("uses the worst service status for degraded sections", () => {
		const status = getSectionStatus([
			monitor("operational"),
			monitor("degraded"),
		]);

		expect(status).toBe("degraded");
		expect(getSectionStatusText(status, 2)).toBe("Services degraded");
	});

	it("shows an empty section summary without status jargon", () => {
		expect(getSectionStatusText("unknown", 0)).toBe("No services");
	});
});
