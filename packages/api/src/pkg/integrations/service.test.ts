import { describe, expect, it } from "bun:test";
import { dedupeNotificationConfigs } from "./service";

describe("notification config selection", () => {
	it("deduplicates configs assigned through multiple monitors", () => {
		const configs = [
			{ id: "notification-1", name: "Primary" },
			{ id: "notification-2", name: "Secondary" },
			{ id: "notification-1", name: "Primary duplicate" },
		];

		expect(dedupeNotificationConfigs(configs)).toEqual([
			{ id: "notification-1", name: "Primary" },
			{ id: "notification-2", name: "Secondary" },
		]);
	});
});
